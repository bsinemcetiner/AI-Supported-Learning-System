"""
services/question_tracker.py

Mimari:
  course → lesson → section → questions

Threshold: DB bazlı sayım — restart'tan etkilenmez, gerçek 24h pencere.
AI: SADECE optional keyword insight için.

key = f"{lesson_id}::{section_index}"
"""

import os
import re
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

QUESTION_THRESHOLD = 5
WINDOW_HOURS = 24

# Sadece spam önleme için in-memory
# { key: datetime }
_notified_at: dict = {}


# ── 1. Hybrid confusion filtresi (regex önce, AI fallback) ───────────────────
def _is_confusion_question(message: str) -> bool:
    if not message:
        return False

    text = message.strip().lower()
    text = re.sub(r"\s+", " ", text)

    if len(text) < 15:
        return False

    # Kesin ignore listesi
    ignore_phrases = [
        "thank you", "thanks", "thx", "got it", "okay", "ok", "alright",
        "makes sense", "i understand", "understood", "nice", "cool",
        "teşekkür", "tesekkur", "sağ ol", "sag ol", "tamam", "okey",
        "anladım", "anladim", "mantıklı", "mantikli", "eyvallah",
        "translate", "çevir", "cevir", "in turkish", "in english",
        "türkçe", "turkce", "ingilizce",
        "test", "deneme", "hello", "hi", "merhaba", "selam",
    ]

    if any(phrase in text for phrase in ignore_phrases):
        return False

    # Regex ile açık confusion keyword'ler — True dönerse AI çağırma (token tasarrufu)
    confusion_patterns = [
        r"\bwhy\b", r"\bhow\b",
        r"\bwhat is\b", r"\bwhat does\b", r"\bwhat are\b",
        r"\bwhen do we use\b", r"\bwhere do we use\b",
        r"\bdifference between\b",
        r"\bi don'?t understand\b", r"\bi am confused\b", r"\bconfused\b",
        r"\bcan you explain\b", r"\bexplain\b", r"\bdoes .* mean\b",
        r"\bcan you clarify\b", r"\bi got confused\b",
        r"\bstill don'?t get\b", r"\bnot sure (about|how|why|what)\b",
        r"\bneden\b", r"\bniye\b", r"\bnasıl\b", r"\bnasil\b",
        r"\bne demek\b", r"\bne işe yarar\b", r"\bne ise yarar\b",
        r"\bmantığı ne\b", r"\bmantigi ne\b", r"\bmantık\b", r"\bmantik\b",
        r"\bfarkı ne\b", r"\bfarki ne\b",
        r"\barasındaki fark\b", r"\barasindaki fark\b",
        r"\banlamadım\b", r"\banlamadim\b",
        r"\bkafam karıştı\b", r"\bkafam karisti\b",
        r"\bkarıştırdım\b", r"\bkaristirdim\b", r"\bkarıştım\b", r"\bkaristim\b",
        r"\baçıklar mısın\b", r"\baciklar misin\b",
        r"\banlatır mısın\b", r"\banlatir misin\b",
        r"\banlayamadım\b", r"\banlayamadim\b",
        r"\bneden böyle\b", r"\bneden boyle\b",
        r"\bbu ne\b", r"\bbu nedir\b",
        r"\bne zaman kullan\b", r"\bne için kullan\b", r"\bne icin kullan\b",
        r"\bnerede kullan\b",
        r"\bhata nerede\b", r"\bneden çalışmıyor\b", r"\bneden calısmiyor\b",
    ]

    if any(re.search(pattern, text) for pattern in confusion_patterns):
        return True

    # ? ile bitiyorsa kesin say
    if text.endswith("?") and len(text) >= 20:
        return True

    # Belirsiz mesaj → AI'ya sor (token sadece burada harcanır)
    return _ai_is_confusion(message)


def _ai_is_confusion(message: str) -> bool:
    """
    Regex'in yakalayamadığı belirsiz mesajlar için AI kullan.
    Hata alırsa False döner — threshold etkilenmez.
    """
    try:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            return False

        from groq import Groq
        client = Groq(api_key=api_key)
        resp = client.chat.completions.create(
            model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
            messages=[{
                "role": "user",
                "content": (
                    f'Student message: "{message}"\n\n'
                    "Is this message a genuine academic confusion/question that a teacher should know about? "
                    "Reply with ONLY 'yes' or 'no'. No explanation."
                ),
            }],
            max_tokens=3,
            temperature=0,
        )
        answer = resp.choices[0].message.content.strip().lower()
        return answer.startswith("yes")
    except Exception as e:
        print(f"[QuestionTracker] AI confusion check failed (non-fatal): {e}")
        return False


# ── 2. DB helpers ────────────────────────────────────────────────────────────
def _log_to_db(db: Session, lesson_id: str, section_index: int, course_id: str, question: str):
    from models.question_log import QuestionLog
    entry = QuestionLog(
        lesson_id=lesson_id,
        section_index=section_index,
        course_id=course_id,
        student_question=question,
    )
    db.add(entry)
    db.commit()


def _count_from_db(db: Session, lesson_id: str, section_index: int) -> int:
    from models.question_log import QuestionLog
    cutoff = datetime.utcnow() - timedelta(hours=WINDOW_HOURS)
    return (
        db.query(QuestionLog)
        .filter(
            QuestionLog.lesson_id == lesson_id,
            QuestionLog.section_index == section_index,
            QuestionLog.asked_at >= cutoff,
        )
        .count()
    )


def _get_recent_questions(db: Session, lesson_id: str, section_index: int) -> list:
    from models.question_log import QuestionLog
    cutoff = datetime.utcnow() - timedelta(hours=WINDOW_HOURS)
    rows = (
        db.query(QuestionLog)
        .filter(
            QuestionLog.lesson_id == lesson_id,
            QuestionLog.section_index == section_index,
            QuestionLog.asked_at >= cutoff,
        )
        .order_by(QuestionLog.asked_at.desc())
        .limit(10)
        .all()
    )
    return [r.student_question for r in rows if r.student_question]


# ── 3. Optional AI keyword insight (token hatası olsa da sistem çalışır) ──────
def _get_keyword_insights(questions: list, section_title: str) -> str:
    """
    Son soruların en sık geçen kelimelerini basit frequency ile bul.
    Groq çağrısı YAPAR ama hata alırsa sessizce atlar — threshold etkilenmez.
    """
    if not questions:
        return ""

    # ── 3a. Basit keyword frequency (AI olmadan) ─────────────────────────────
    stopwords = {
        "the", "a", "an", "is", "it", "in", "of", "to", "and", "or", "for",
        "what", "how", "why", "when", "does", "do", "can", "i", "you", "we",
        "this", "that", "with", "are", "was", "be", "on", "at", "bu", "bir",
        "ne", "ve", "de", "da", "mi", "mu", "mı", "mü", "için", "ile",
    }
    freq: dict = {}
    for q in questions:
        words = re.findall(r"\b[a-zA-ZğüşıöçĞÜŞİÖÇ]{3,}\b", q.lower())
        for w in words:
            if w not in stopwords:
                freq[w] = freq.get(w, 0) + 1

    top_keywords = sorted(freq, key=lambda k: freq[k], reverse=True)[:5]

    if not top_keywords:
        return ""

    # ── 3b. Opsiyonel Groq insight ─────────────────────────────────────────
    groq_insight = ""
    try:
        api_key = os.getenv("GROQ_API_KEY")
        if api_key:
            from groq import Groq
            import json as _json
            client = Groq(api_key=api_key)
            questions_text = "\n".join(f"- {q}" for q in questions[-8:])
            resp = client.chat.completions.create(
                model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
                messages=[{
                    "role": "user",
                    "content": (
                        f"Section: {section_title}\n"
                        f"Student questions:\n{questions_text}\n\n"
                        "List 3 specific concepts students are confused about. "
                        "Reply with ONLY a JSON array of short strings (2-4 words). "
                        'Example: ["format specifiers", "pointer arithmetic"]. '
                        "No explanation."
                    ),
                }],
                max_tokens=60,
                temperature=0,
            )
            raw = resp.choices[0].message.content.strip()
            start, end = raw.find("["), raw.rfind("]")
            if start != -1 and end != -1:
                topics = _json.loads(raw[start:end+1])
                if topics:
                    groq_insight = "\n".join(f"  • {t}" for t in topics[:3])
    except Exception as e:
        print(f"[QuestionTracker] Optional AI insight failed (non-fatal): {e}")

    # Groq başarılıysa onu kullan, değilse keyword frequency'yi göster
    if groq_insight:
        return f"\n\nMost confusing concepts:\n{groq_insight}"
    else:
        kw_lines = "\n".join(f"  • {k}" for k in top_keywords)
        return f"\n\nTop confusion keywords:\n{kw_lines}"


# ── 4. Ana tracker fonksiyonu ─────────────────────────────────────────────────
def track_question(
    db: Session,
    lesson_id: str,
    lesson_title: str,
    section_index: int,
    section_title: str,
    course_id: str,
    teacher_username: str,
    student_question: str,
):
    """
    Deterministik threshold — AI bağımsız.
    key = lesson_id::section_index
    """
    if not _is_confusion_question(student_question):
        print("[QuestionTracker] Skipped — not a confusion question")
        return

    key = f"{lesson_id}::{section_index}"
    now = datetime.utcnow()

    # DB'ye kaydet
    try:
        _log_to_db(db, lesson_id, section_index, course_id, student_question)
    except Exception as e:
        print(f"[QuestionTracker] DB log failed: {e}")
        return

    # DB'den say (gerçek 24h pencere)
    count = _count_from_db(db, lesson_id, section_index)
    print(f"[QuestionTracker] key={key} section='{section_title}' count={count}/{QUESTION_THRESHOLD}")

    if count < QUESTION_THRESHOLD:
        return

    # Spam önleme — 24 saat içinde tekrar bildirim gitmesin
    last = _notified_at.get(key)
    if last and (now - last) < timedelta(hours=WINDOW_HOURS):
        print(f"[QuestionTracker] Already notified for {key}, skipping.")
        return

    _notified_at[key] = now

    # Son soruları DB'den çek (AI insight için)
    recent_questions = _get_recent_questions(db, lesson_id, section_index)
    insight = _get_keyword_insights(recent_questions, section_title)

    try:
        from models.notification import Notification
        n = Notification(
            course_id=course_id,
            title=f"📊 Students struggling: {section_title}",
            message=(
                f'In lesson "{lesson_title}", section "{section_title}", '
                f"{count} confusion questions were asked in the last {WINDOW_HOURS} hours."
                f"{insight}\n\n"
                f"Consider revisiting this section or adding more explanation."
            ),
            type="struggle_alert",
            created_by="system",
            target_role="teacher",
        )
        db.add(n)
        db.commit()
        print(f"[QuestionTracker] ✅ Notification sent | course={course_id} | section='{section_title}'")
    except Exception as e:
        print(f"[QuestionTracker] Failed to save notification: {e}")
        db.rollback()
