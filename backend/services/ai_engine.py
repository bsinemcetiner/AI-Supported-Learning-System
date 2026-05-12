import os
import re
from groq import Groq


def _normalize_latex(text: str) -> str:
    if not text:
        return ""

    text = text.replace("<br>", " ")

    text = re.sub(r"\\\[(.*?)\\\]", r"\n$$\1$$\n", text, flags=re.DOTALL)
    text = re.sub(r"\\\((.*?)\\\)", r"$\1$", text, flags=re.DOTALL)

    text = re.sub(
        r"(?<!\$)(\\begin\{(?:bmatrix|pmatrix|matrix|vmatrix|Bmatrix)\}.*?\\end\{(?:bmatrix|pmatrix|matrix|vmatrix|Bmatrix)\})(?!\$)",
        r"\n$$\1$$\n",
        text,
        flags=re.DOTALL
    )

    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _trim_text(text: str, max_chars: int = 12000) -> str:
    if not text:
        return ""

    text = text.strip()
    if len(text) <= max_chars:
        return text

    return text[:max_chars] + "\n\n[Context truncated for length.]"


def _get_client() -> Groq:
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        raise ValueError("GROQ_API_KEY bulunamadı veya boş. .env içine gerçek anahtarı eklemelisin.")
    return Groq(api_key=api_key)


def _get_model_name() -> str:
    # İstersen .env içine GROQ_MODEL de koyabilirsin
    return os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()

def detect_response_language(text: str) -> str:
    """
    Lightweight language detector for response language control.
    Currently focuses on Turkish vs English because the app mainly uses these.
    """
    if not text:
        return "English"

    lowered = text.lower()

    turkish_chars = set("çğıöşüÇĞİÖŞÜ")
    if any(ch in text for ch in turkish_chars):
        return "Turkish"

    turkish_words = {
        "nedir", "nasıl", "neden", "niye", "anlat", "anlatır", "açıkla",
        "açıklar", "örnek", "örnekle", "bunu", "şunu", "mısın", "misin",
        "miyim", "miyiz", "mi", "mı", "mu", "mü", "ders", "konu",
        "kısaca", "detaylı", "türkçe", "yardım", "çöz", "çözer",
        "göster", "ekle", "çıkar", "düzelt", "basitleştir", "tablo",
        "kod", "slayt", "görsel", "materyal", "hoca", "öğrenci",
    }

    tokens = set(re.findall(r"[a-zA-ZğüşöçıİĞÜŞÖÇ]+", lowered))
    if tokens.intersection(turkish_words):
        return "Turkish"

    return "English"


def _get_latest_user_message(messages: list) -> str:
    for message in reversed(messages or []):
        if message.get("role") == "user":
            return message.get("content", "") or ""
    return ""


def _extract_teacher_language_signal(custom_prompt: str = "", feedback_history: list = None) -> str:
    """
    Extracts teacher-written parts from large English prompt templates.
    This prevents the English JSON/template instructions from overpowering
    Turkish teacher feedback such as 'daha basit anlat, tablo ekle'.
    """
    signals = []

    if feedback_history:
        signals.extend([fb for fb in feedback_history if fb and fb.strip()])

    custom_prompt = custom_prompt or ""

    patterns = [
        r"Teacher instructions:\s*(.*?)(?:STRICT REQUIREMENTS:|ADDITIONAL TEACHER INSTRUCTIONS:|$)",
        r"ADDITIONAL TEACHER INSTRUCTIONS:\s*(.*)$",
        r"TEACHER'S CUSTOM INSTRUCTION:\s*(.*?)(?:TEACHER'S PAST FEEDBACK|$)",
        r"TEACHER'S PAST FEEDBACK.*?:\s*(.*)$",
    ]

    for pattern in patterns:
        match = re.search(pattern, custom_prompt, flags=re.DOTALL | re.IGNORECASE)
        if match:
            extracted = match.group(1).strip()
            if extracted:
                signals.append(extracted)

    return "\n".join(signals).strip()


def _resolve_response_language(
    messages: list,
    custom_prompt: str = "",
    feedback_history: list = None,
) -> str:
    """
    Priority:
    1. Teacher-written feedback/custom instruction language
    2. Latest user/student message language
    3. English fallback
    """
    teacher_signal = _extract_teacher_language_signal(
        custom_prompt=custom_prompt,
        feedback_history=feedback_history or [],
    )

    if teacher_signal:
        detected = detect_response_language(teacher_signal)
        if detected == "Turkish":
            return "Turkish"

    latest_user_message = _get_latest_user_message(messages)
    return detect_response_language(latest_user_message)


def _build_language_instruction(response_language: str) -> str:
    if response_language == "Turkish":
        return """
LANGUAGE CONTROL — STRICT:
- The response language MUST be Turkish.
- The student/teacher is using Turkish, so answer in Turkish.
- Do NOT switch to English just because the lesson material, OCR text, JSON template, or system instructions are in English.
- Keep technical terms such as C#, LINQ, class, method, API, JSON, SQL, object-oriented programming in their standard form when natural.
- If you return structured JSON, keep JSON keys exactly as requested, but write all human-facing values in Turkish:
  titles, subtitles, body text, highlights, learning objectives, takeaways, summaries, and closing sentences.
""".strip()

    return """
LANGUAGE CONTROL — STRICT:
- The response language MUST be English.
- Answer in English unless the student/teacher clearly asks in another language.
- Do not change the language based on the course context alone.
- If you return structured JSON, keep JSON keys exactly as requested and write human-facing values in English.
""".strip()


def _get_style_instruction(teaching_style: str) -> str:
    style_instructions = {
        "Professional Tutor": """
Speak like a university lecturer who genuinely enjoys teaching.
- Use precise language but stay conversational, not robotic.
- Use natural transitions: "Now, here's the key idea...", "Let's think about this carefully.", "Notice that..."
- Structure your answer as a flowing explanation, not a bullet list dump.
- Acknowledge the student's question naturally before diving in.
- FORBIDDEN: dry textbook phrasing, excessive bullet points, robotic sentence structure.
GOOD: "Now, here's where it gets interesting — frequency isn't just about sound, it's everywhere..."
BAD: "Frequency is defined as the number of cycles per second."
""",

        "Friendly Mentor": """
Speak like a knowledgeable older friend who loves helping — casual, warm, and zero judgment.
- Use informal language: "So basically...", "Here's the thing...", "Don't worry, this one trips everyone up."
- Share relatable analogies from everyday life (music, sports, food, social media).
- Make the student feel like it's totally fine not to know things.
- End with something inviting like "Does that click?" or "Want me to go deeper on any part?"
- FORBIDDEN: formal academic tone, stiff sentence structure, cold or impersonal phrasing.
GOOD: "Okay so basically, think of frequency like how often your favorite song drops the beat — fast song = high frequency, slow ballad = low."
BAD: "Frequency is a measure of the number of occurrences of a repeating event per unit of time."
""",

        "Simplified Explainer": """
Explain like you're talking to someone who just encountered this topic for the very first time.
- Always start with a concrete real-life example BEFORE any definition or formula.
- Use short sentences. One idea per sentence.
- If you must use a technical term, immediately define it in plain words right after.
- FORBIDDEN: jargon without explanation, long complex sentences, multiple concepts at once.
GOOD: "Imagine a swing going back and forth. How many times it swings in one second — that's frequency."
BAD: "Frequency, measured in Hertz, is the reciprocal of the period of a periodic waveform."
""",

        "Encouraging Coach": """
Speak like an energetic coach who deeply believes in the student's ability to master this.
- Actively celebrate effort and progress: "Yes! That's exactly the right instinct!", "You're already thinking like a physicist!"
- When a student is wrong or stuck, reframe positively: "Good try — you're actually really close. Here's the nudge you need..."
- Use motivating language throughout the entire response, not just the opening.
- Make the student feel capable even when the topic is hard.
- FORBIDDEN: neutral or flat tone, cold corrections, explaining without acknowledging the student's effort.
GOOD: "Nice — you're already halfway there! Just add that we measure it per second, giving us the unit hertz. You've totally got this."
BAD: "That is partially correct. Frequency is measured in hertz, not just repetitions."
""",

        "Funny YouTuber": """
Speak like an entertaining educational YouTuber — high energy, funny, but genuinely teaches.
- Open with something dramatic or hooky: "Okay so this sounds boring but it's actually WILD."
- Use humor, unexpected analogies, and light sarcasm — never at the student's expense.
- Keep it punchy. No long dry paragraphs.
- FORBIDDEN: boring academic tone, zero personality, humor that confuses rather than clarifies.
GOOD: "Frequency is basically how hyper a wave is. 440 vibrations per second? That's concert A. Twice a second? That wave is basically asleep."
BAD: "Frequency is defined as the number of cycles per unit time."
""",

        "Deep Scientist": """
Speak like a researcher explaining to a curious, capable colleague.
- Use correct technical terminology from the start.
- Reference underlying principles, mathematical relationships, and edge cases.
- Think out loud: "What's interesting here is...", "One subtlety worth noting..."
- Don't oversimplify — trust the student to handle complexity.
- FORBIDDEN: dumbing down, skipping nuance, avoiding math or formalism when it adds clarity.
GOOD: "Frequency formally sits as f = 1/T, but its perceptual logarithmic nature is what makes the decibel scale and the octave system so natural."
BAD: "Frequency is how often something repeats. It's measured in Hz."
""",

        "Simplified (for kids)": """
Speak like a fun, patient teacher explaining to a curious 8-year-old.
- Use only simple words. Short sentences. Big ideas through tiny examples.
- Analogies must come from a child's world: toys, animals, cartoons, games, food.
- Be enthusiastic — make it feel like an adventure.
- FORBIDDEN: any jargon without instant simple explanation, long sentences, abstract concepts without concrete anchoring.
GOOD: "You know how a hummingbird flaps its wings really really fast? That fast flapping is like high frequency — lots of flaps every second!"
BAD: "Frequency refers to the rate of oscillation of a periodic phenomenon."
""",
    }
    return style_instructions.get(teaching_style, "Be clear, helpful, and conversational.")


def _get_mode_instruction(mode: str) -> str:
    style_mode_bridge = """
STYLE + MODE NOTE:
Your style controls HOW you phrase things. Your mode controls WHAT you do.
Apply your style to every sentence — including questions and hints.
Style affects word choice, energy, and warmth. It does NOT change whether you explain or ask.

Quick reminders by style:
- Friendly Mentor: casual, warm, use "so basically", "here's the thing", end with "does that click?"
- Encouraging Coach: energetic, celebrate effort, use "you're so close!", "great instinct!"
- Funny YouTuber: punchy, dramatic opener, light humor
- Professional Tutor: precise, flowing sentences, natural transitions
- Deep Scientist: rigorous, think out loud, embrace complexity
- Simplified Explainer: short sentences, example first, one idea at a time
"""

    mode_instructions = {
        "direct": """
Give a direct, clear explanation.
Answer the user's question normally and helpfully.
You may explain step by step if useful.
""",

        "hint_first": """
Your role is to give ONE small nudge, not an explanation.

RULES — never break these:
1. Give only ONE short hint (1-2 sentences max).
2. The hint must point toward the answer WITHOUT stating it.
3. Do NOT explain the concept. Do NOT summarize what the topic is about.
4. Do NOT use bullet points or headers.
5. After the hint, stop completely. Do not add more.
6. Only reveal more if the student replies and asks for another hint.
""",

        "socratic": """
You are a STRICT Socratic tutor. Your only job is to ask ONE question per turn. You never explain.

ABSOLUTE RULES:
1. NEVER explain the concept — not even partially.
2. Ask exactly ONE short question per response. Never two.
3. Your question must NOT contain or imply the answer.
4. Maximum response length: 2 sentences total.
5. Do NOT use bullet points, headers, or lists.
6. If the student answers correctly → ask a deeper follow-up question on the same topic.
7. If the student answers incorrectly → ask "Why do you think that?" — never correct directly.
8. If the student says "just tell me" or "I give up" → switch to a brief direct explanation.
9. NEVER repeat a question you already asked. Read the full conversation before responding.
""",

        "quiz_me": """
You are a quiz tutor. Your job is to test the student's knowledge through questions.

STRICT RULES — never break these:
1. FIRST TURN ONLY: Ask ONE short quiz question based on the course context.
2. NEVER repeat or rephrase a question you already asked in this conversation.
3. NEVER ask the student a question they just asked you — read the conversation history carefully.
4. After the student answers: evaluate their answer, then ask a NEW follow-up question on a related subtopic.
5. If the student is correct: say so briefly (1 sentence), then ask a harder follow-up.
6. If the student is wrong: give ONE small hint without revealing the answer, then let them try again.
7. Do NOT explain the full concept unless the student explicitly asks for it.
8. Keep all responses under 4 sentences.
9. Track what has already been asked — never loop back to a previous question.
""",
    }

    base = mode_instructions.get(mode, mode_instructions["direct"])
    return style_mode_bridge + "\n" + base


def _get_first_turn_instruction(mode: str) -> str:
    instructions = {
        "socratic": (
            "This is the student's FIRST message. They have not answered anything yet. "
            "Do NOT explain anything. Do NOT teach. "
            "Ask only one opening question to explore what they already know. "
            "Keep it under 2 sentences."
        ),
        "hint_first": (
            "This is the student's FIRST message. They have not received any hints yet. "
            "Give only one small nudge. Do NOT explain the full concept. "
            "Keep it under 2 sentences."
        ),
        "quiz_me": (
            "This is the student's FIRST message. "
            "Ask ONE clear quiz question based on the course context to check their prior knowledge. "
            "Do NOT explain anything. Do NOT ask what they already know about — just pick a topic from the context and ask. "
            "Keep it under 2 sentences."
        ),
    }
    return instructions.get(mode, "")


def _build_teacher_feedback_block(
    custom_prompt: str = "",
    feedback_history: list = None,
) -> str:
    parts = []

    if custom_prompt and custom_prompt.strip():
        parts.append(f"TEACHER'S CUSTOM INSTRUCTION:\n{custom_prompt.strip()}")

    if feedback_history:
        cleaned = [f.strip() for f in feedback_history if f and f.strip()]
        if cleaned:
            numbered = "\n".join(f"{i+1}. {fb}" for i, fb in enumerate(cleaned))
            parts.append(
                f"TEACHER'S PAST FEEDBACK (apply all of these to your explanations):\n{numbered}"
            )

    if not parts:
        return ""

    block = "\n\n".join(parts)
    return f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUCTOR PERSONALIZATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{block}

These are direct instructions from the course instructor.
Follow them strictly and consistently throughout your response.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
""".strip()


def _build_system_instruction(
    context: str,
    teaching_style: str,
    mode: str,
    custom_prompt: str = "",
    feedback_history: list = None,
    response_language: str = "English",
) -> str:
    style_instruction = _get_style_instruction(teaching_style)
    mode_instruction = _get_mode_instruction(mode)
    cleaned_context = _trim_text(context, 12000)
    language_instruction = _build_language_instruction(response_language)

    teacher_block = _build_teacher_feedback_block(
        custom_prompt=custom_prompt,
        feedback_history=feedback_history or [],
    )

    context_usage_note = ""
    if mode in ("socratic", "hint_first", "quiz_me"):
        context_usage_note = (
            "IMPORTANT: Even if the course context contains the full answer, "
            "do NOT use it to explain or lecture. "
            "The course context is only for you to understand the topic — "
            "not to copy explanations from it into your response."
        )

    system_instruction = f"""
You are an AI learning assistant.

{language_instruction}

STYLE:
{style_instruction}

TEACHING MODE:
{mode_instruction}

{teacher_block}

IMPORTANT BEHAVIOR RULES:
1. Follow the LANGUAGE CONTROL section above. It has higher priority than style, mode, course context, OCR text, and teacher templates.

2. Speak naturally, like a real teacher talking to a student.

3. Be educational, clear, and honest.

4. You are STRICTLY limited to the provided COURSE CONTEXT for academic questions.

5. If the answer is clearly supported by the course context, answer using only that information.

6. If the user's question is unrelated to the course materials OR the answer is not found in the context:
   - clearly say the question is outside the uploaded lesson/materials,
   - do NOT answer from general knowledge,
   - do NOT guess,
   - do NOT fabricate,
   - invite the student to ask something based on the lesson.

7. Never use outside/world knowledge for lesson questions.

8. Never fabricate or misrepresent course content.

9. If the user asks about math, you may use LaTeX with $ or $$.

10. Do not use <br> tags.

11. Keep the answer readable and natural.

12. If the user is greeting, thanking, or making small talk, respond briefly.

13. In socratic mode, ask ONE question per turn. Never explain.

14. In hint_first mode, give only ONE nudge per turn.

15. If the student has not answered yet, do not continue solving multiple steps at once.

16. If the user explicitly asks for the full answer, only give it if supported by course context.
{context_usage_note}
STRICT COURSE BOUNDARY:
Your knowledge source for lesson questions is ONLY the course context below.
If missing, refuse politely.
Never fill gaps with external knowledge.
COURSE CONTEXT:
{cleaned_context if cleaned_context else "No course context provided."}
""".strip()

    return system_instruction


def _build_extra_messages(mode: str, is_first_turn: bool) -> list:
    extra_messages = []

    if mode == "socratic":
        extra_messages.append({
            "role": "system",
            "content": (
                "REMINDER: Ask only ONE guiding question. "
                "Do NOT explain anything. "
                "Do NOT embed the answer inside the question. "
                "Do NOT name the final concept. "
                "Maximum 2 sentences."
            )
        })
    elif mode == "hint_first":
        extra_messages.append({
            "role": "system",
            "content": (
                "REMINDER: Give only ONE small hint. "
                "Do NOT explain the concept. "
                "Do NOT reveal the answer. "
                "Maximum 2 sentences."
            )
        })
    elif mode == "quiz_me":
        extra_messages.append({
            "role": "system",
            "content": (
                "REMINDER: Ask ONE new quiz question. "
                "NEVER repeat a question already asked in this conversation. "
                "NEVER ask the student a question they just asked you — check the conversation history. "
                "Do NOT explain anything yet. Wait for the student's answer."
            )
        })

    if is_first_turn and mode in ("socratic", "hint_first", "quiz_me"):
        first_turn_note = _get_first_turn_instruction(mode)
        if first_turn_note:
            extra_messages.append({
                "role": "system",
                "content": first_turn_note
            })

    return extra_messages


def _build_messages(system_instruction: str, extra_messages: list, messages: list) -> list:
    return [{"role": "system", "content": system_instruction}] + extra_messages + messages


def generate_ai_response(
    messages,
    context,
    teaching_style="Professional Tutor",
    mode="direct",
    custom_prompt: str = "",
    feedback_history: list = None,
):
    response_language = _resolve_response_language(
        messages=messages,
        custom_prompt=custom_prompt,
        feedback_history=feedback_history or [],
    )

    system_instruction = _build_system_instruction(
        context=context,
        teaching_style=teaching_style,
        mode=mode,
        custom_prompt=custom_prompt,
        feedback_history=feedback_history or [],
        response_language=response_language,
    )

    user_messages = [m for m in messages if m.get("role") == "user"]
    assistant_messages = [m for m in messages if m.get("role") == "assistant"]
    is_first_turn = len(user_messages) <= 1 and len(assistant_messages) == 0
    extra_messages = _build_extra_messages(mode, is_first_turn)

    client = _get_client()
    response = client.chat.completions.create(
        model=_get_model_name(),
        messages=_build_messages(system_instruction, extra_messages, messages),
        temperature=0.4,
        stream=False,
    )

    content = response.choices[0].message.content or ""
    return _normalize_latex(content)


def stream_ai_response(
    messages,
    context="",
    teaching_style="Professional Tutor",
    mode="direct",
    image_data=None,
    custom_prompt: str = "",
    feedback_history: list = None,
):

    combined_context = context or ""

    response_language = _resolve_response_language(
        messages=messages,
        custom_prompt=custom_prompt,
        feedback_history=feedback_history or [],
    )

    system_instruction = _build_system_instruction(
        context=combined_context,
        teaching_style=teaching_style,
        mode=mode,
        custom_prompt=custom_prompt,
        feedback_history=feedback_history or [],
        response_language=response_language,
    )

    user_messages = [m for m in messages if m.get("role") == "user"]
    assistant_messages = [m for m in messages if m.get("role") == "assistant"]
    is_first_turn = len(user_messages) <= 1 and len(assistant_messages) == 0
    extra_messages = _build_extra_messages(mode, is_first_turn)

    client = _get_client()
    stream = client.chat.completions.create(
        model=_get_model_name(),
        messages=_build_messages(system_instruction, extra_messages, messages),
        temperature=0.4,
        stream=True,
    )

    full_answer = ""
    for chunk in stream:
        delta = chunk.choices[0].delta.content or ""
        if delta:
            full_answer += delta
            yield _normalize_latex(full_answer)