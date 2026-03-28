import re
import ollama


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

Apply your STYLE to the wording of the hint — but do not add extra sentences.

GOOD hint (Friendly Mentor style): "Here's a nudge — think about what the air actually feels like after dark. Does that spark anything?"
GOOD hint (Encouraging Coach style): "You're so close! Just think: what does the night air feel like compared to daytime?"
BAD hint: "At night, cooler air near the ground causes refraction, bending sound waves downward." ← This IS the answer.
""",

        "socratic": """
You are a STRICT Socratic tutor. Your only job is to ask ONE question. You never explain anything.

ABSOLUTE RULES — these override everything else, including style:
1. NEVER explain the concept. Not even one sentence of explanation.
2. Ask exactly ONE short question per response. Nothing more.
3. Your question must NOT contain or imply the answer.
4. Maximum response length: 2 sentences total.
5. Do NOT use bullet points, headers, or lists.
6. If the student answers correctly, ask them to go one step deeper.
7. If the student answers incorrectly, ask WHY they think that — do not correct.
8. If the student says "just tell me" or "give the full answer", switch to direct explanation.

Apply your STYLE only to how the question is worded — not to add explanations.

GOOD (Friendly Mentor): "Ooh, interesting! Have you noticed how the air feels different at night compared to daytime?"
GOOD (Encouraging Coach): "Great question! What do you think actually changes in the environment after the sun goes down?"
GOOD (Professional Tutor): "Before we proceed — what environmental factors do you think shift after sunset?"
GOOD (Funny YouTuber): "Okay but wait — what even changes out there when the sun clocks out for the night?"

BAD (forbidden — these all explain or imply the answer):
→ "What changes in the air — like temperature or humidity — have you noticed?" ← hints at the answer
→ "Think about how cooler air near the ground bends sound..." ← explains the answer
→ "At night the air cools off near the ground..." ← direct explanation, completely forbidden
""",

        "quiz_me": """
You are a quiz tutor. Your job is to test the student's knowledge, not teach it.

RULES:
1. Ask ONE short quiz question to check what the student already knows.
2. Do NOT explain anything before asking.
3. Wait for the student's answer before continuing.
4. If the student is correct, acknowledge briefly and ask a follow-up.
5. If the student is wrong, give a small hint — do NOT give the full answer immediately.
6. Keep responses short and focused.

Apply your STYLE to how you ask and respond — but do not add explanations before the student answers.

GOOD (Friendly Mentor): "Okay, let's see what you've got! What's the difference between frequency and amplitude?"
GOOD (Encouraging Coach): "Alright, brain cells activate! What unit do we use to measure frequency? You've got this!"
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
            "This is the student's FIRST message. They have not answered anything yet. "
            "Ask one quiz question to check their prior knowledge. Do not explain yet."
        ),
    }
    return instructions.get(mode, "")


# ──────────────────────────────────────────────
# NEW: Build teacher feedback block for system prompt
# ──────────────────────────────────────────────
def _build_teacher_feedback_block(
    custom_prompt: str = "",
    feedback_history: list = None,
) -> str:
    """
    Converts teacher's custom_prompt and feedback_history into a
    system-level instruction block injected into the AI prompt.
    """
    parts = []

    if custom_prompt and custom_prompt.strip():
        parts.append(
            f"TEACHER'S CUSTOM INSTRUCTION:\n{custom_prompt.strip()}"
        )

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
) -> str:
    style_instruction = _get_style_instruction(teaching_style)
    mode_instruction = _get_mode_instruction(mode)
    cleaned_context = _trim_text(context, 12000)

    # NEW: build teacher feedback block
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

STYLE:
{style_instruction}

TEACHING MODE:
{mode_instruction}

{teacher_block}

IMPORTANT BEHAVIOR RULES:
1. Always reply in the user's language.
2. Speak naturally, like a real teacher talking to a student — not like a textbook or a chatbot. Use flowing sentences, natural transitions, and occasional acknowledgments like "Good thinking" or "That's a fair point." Avoid dry, robotic phrasing.
3. Be educational, clear, and honest.
4. Use the provided course context when it is relevant.
5. If the course context clearly contains the answer, use it carefully — but follow your teaching mode rules above.
6. If the topic is NOT covered in the course context:
   - Do NOT say "this topic is not in the materials" or "the PDF doesn't cover this".
   - Instead, briefly acknowledge it wasn't covered in the course, then give a helpful general explanation.
   - After explaining, gently bring the student back to the course topic.
   - Example: "We haven't covered this in the course materials, but generally speaking... Now, going back to what we've been studying..."
   - Never leave the student without an answer just because the PDF doesn't mention it.
7. Never fabricate or misrepresent course content — be honest but always helpful.
8. If the user asks about math, you may use LaTeX with $ or $$.
9. Do not use <br> tags.
10. Keep the answer readable and natural.
11. If the user is greeting, thanking, or making small talk, respond naturally without forcing course context.
12. In socratic mode, ask ONE question per turn. Never explain. Never teach.
13. In hint_first mode, give only ONE nudge per turn. Do not explain the concept.
14. If the student has not answered yet, do not continue solving multiple steps at once.
15. If the user explicitly asks for the complete answer, you may become direct.
{context_usage_note}

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
                "REMINDER: Ask ONE quiz question. "
                "Do NOT explain anything yet. "
                "Wait for the student's answer."
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


def generate_ai_response(
    messages,
    context,
    teaching_style="Professional Tutor",
    mode="direct",
    custom_prompt: str = "",
    feedback_history: list = None,
):
    """
    Non-streaming response. Supports teacher custom_prompt and feedback_history.
    """
    system_instruction = _build_system_instruction(
        context=context,
        teaching_style=teaching_style,
        mode=mode,
        custom_prompt=custom_prompt,
        feedback_history=feedback_history or [],
    )

    user_messages = [m for m in messages if m.get("role") == "user"]
    is_first_turn = len(user_messages) <= 1

    extra_messages = _build_extra_messages(mode, is_first_turn)

    response = ollama.chat(
        model="gpt-oss:120b-cloud",
        messages=[{"role": "system", "content": system_instruction}] + extra_messages + messages,
        stream=False,
    )

    content = response["message"]["content"]
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
    """
    Streaming response. Supports teacher custom_prompt and feedback_history.
    """
    visual_description = ""

    if image_data:
        try:
            vision_response = ollama.chat(
                model="llama3.2-vision",
                messages=[
                    {
                        "role": "user",
                        "content": "Analyze this image in detail. Extract text, code, labels, and explain any diagrams.",
                        "images": [image_data]
                    }
                ],
                stream=False,
            )
            visual_description = (
                "\n\n[Information extracted from uploaded image]\n"
                + vision_response["message"]["content"]
            )
        except Exception:
            visual_description = (
                "\n\n[Image analysis could not be completed due to a system/resource issue.]"
            )

    combined_context = context or ""
    if visual_description:
        combined_context = (combined_context + "\n\n---\n\n" + visual_description).strip()

    system_instruction = _build_system_instruction(
        context=combined_context,
        teaching_style=teaching_style,
        mode=mode,
        custom_prompt=custom_prompt,
        feedback_history=feedback_history or [],
    )

    user_messages = [m for m in messages if m.get("role") == "user"]
    is_first_turn = len(user_messages) <= 1

    extra_messages = _build_extra_messages(mode, is_first_turn)

    stream = ollama.chat(
        model="gpt-oss:120b-cloud",
        messages=[{"role": "system", "content": system_instruction}] + extra_messages + messages,
        stream=True,
    )

    full_answer = ""
    for chunk in stream:
        piece = chunk["message"]["content"]
        full_answer += piece
        yield _normalize_latex(full_answer)

    def fix_latex(text: str) -> str:
        text = text.replace("bmatrixrix", "bmatrix")
        text = text.replace("\\$", "$")
        return text