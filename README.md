# LASSIE — AI-Supported Learning System

LASSIE is a role-based AI-supported learning platform designed to help teachers create structured lesson content and help students study from approved course materials through personalized AI chat experiences.

Teachers can create courses, upload lesson PDFs, generate AI-supported lesson sections, refine generated explanations with feedback, approve them, and publish them for students. Students can access published lessons, ask lesson-based questions, upload screenshots, receive context-aware explanations, and study with different learning modes and teaching tones.

---

## Features

### Teacher Features

- Create and manage courses
- Upload course materials
- Upload lesson PDFs
- Automatically split uploaded lessons into sections
- Generate AI-supported lesson explanations for each section
- Review and improve generated content with teacher feedback
- Approve and publish lesson sections
- Provide custom instructions for generated explanations
- Manage published content for students

### Student Features

- View available or assigned courses
- Access published lessons
- Study structured AI-generated lesson explanations
- Start lesson-based AI chats
- Ask questions based on approved lesson and course materials
- Upload images or screenshots and ask questions about them
- Receive answers in the same language as the question
- Ask for summaries, examples, code explanations, tables, and comparisons
- Use text-to-speech support for AI responses
- Take notes while studying

---

## AI Capabilities

LASSIE uses AI to support both teacher-side content creation and student-side learning.

### Teacher-side AI

- Extracts lesson content from uploaded PDFs
- Splits lesson PDFs into logical sections
- Generates structured lesson explanations
- Supports teacher feedback and custom prompts
- Produces slide-like educational lesson content
- Helps teachers refine content before publishing

### Student-side AI

- Answers questions using selected lesson or course context
- Restricts academic answers to uploaded lesson/course materials
- Supports image-based questions using OCR-extracted text
- Checks whether uploaded images are related to the selected lesson/course
- Responds in the language requested by the student
- Provides readable explanations with headings, examples, tables, and code blocks

---

## Chat Modes

Students can choose different learning modes depending on how they want to study.

| Mode | Purpose |
|---|---|
| Direct Explanation | Gives a clear and complete explanation |
| Hint First | Gives a small hint instead of the full answer |
| Socratic Tutor | Guides the student by asking questions |
| Quiz Me | Tests the student with lesson-based questions |

---

## Teaching Tones

Students can personalize the style of AI responses.

| Tone                 | Description |
|----------------------|---|
| Professional Tutor   | Clear, structured, and academic |
| Friendly Mentor      | Warm, casual, and supportive |
| Simplified Explainer | Beginner-friendly and simple |
| Encouraging Coach    | Motivational and confidence-building |
| Funny YouTuber       | Energetic and entertaining |
| Deep Scientist       | More technical and detailed |
| Simplify             | Very simple and playful |

---

## Tech Stack

### Backend

- FastAPI
- SQLAlchemy
- PostgreSQL
- JWT Authentication
- Groq LLM API
- Qdrant Vector Database
- Sentence Transformers
- OCR / text extraction services

### Frontend

- Vite
- React
- TypeScript
- React Markdown
- remark-gfm
- Framer Motion
- Lucide React
- React Syntax Highlighter
- Unsplash API integration for lesson visuals

---

## Prerequisites

Make sure the following tools are installed:

- Python 3.10+
- Node.js
- PostgreSQL
- pgAdmin or another PostgreSQL client
- Git

If you use Qdrant locally, make sure Qdrant is also running.

---

## Database Setup

Create a PostgreSQL database named:

```text
ai_learning
```

Then configure the backend environment variables according to your local PostgreSQL credentials.

Example database URL:

```env
DATABASE_URL=postgresql+psycopg2://postgres:your_password@localhost:5432/ai_learning
```

---

## Backend Setup

Go to the backend folder:

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv venv
```

Activate the virtual environment.

On Windows:

```bash
venv\Scripts\activate
```

On macOS/Linux:

```bash
source venv/bin/activate
```

Install backend dependencies:

```bash
pip install -r requirements.txt
```

Create a `.env` file inside the `backend` folder.

Example `.env` file:

```env
DATABASE_URL=postgresql+psycopg2://postgres:your_password@localhost:5432/ai_learning
JWT_SECRET_KEY=your_jwt_secret_key
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
ELEVENLABS_API_KEY=your_elevenlabs_key
```

Start the backend server:

```bash
 uvicorn main:app --reload --port 8011
```

The backend will run at:

```text
http://127.0.0.1:8011
```

Swagger API documentation:

```text
http://127.0.0.1:8011/docs
```

---

## Frontend Setup

Open a new terminal and go to the frontend folder:

```bash
cd frontend
```

Install frontend dependencies:

```bash
npm install
```

If needed, install additional UI and markdown dependencies:

```bash
npm install framer-motion lucide-react react-markdown remark-gfm react-syntax-highlighter
```

Create a `.env` file inside the `frontend` folder if the project uses external frontend API keys.

Example frontend `.env` file:

```env
VITE_UNSPLASH_ACCESS_KEY=your_unsplash_access_key
```

Start the frontend development server:

```bash
npm run dev
```

The frontend will usually run at:

```text
http://localhost:5173
```

---

## Main User Flow

### Teacher Flow

1. Teacher logs in.
2. Teacher creates a course.
3. Teacher uploads course materials or lesson PDFs.
4. The system extracts lesson text from the uploaded PDF.
5. The lesson is automatically split into sections.
6. Teacher generates AI-supported section explanations.
7. Teacher reviews and improves the generated content with feedback.
8. Teacher approves and publishes lesson sections.
9. Students can access the published lesson content.

### Student Flow

1. Student logs in.
2. Student opens an available or assigned course.
3. Student selects a published lesson.
4. Student studies the AI-generated lesson content.
5. Student asks questions in the lesson chat.
6. AI answers using the selected lesson/course context.
7. Student can ask for examples, summaries, tables, code explanations, quiz questions, or image-based help.

---

## Image-based Questions

Students can upload screenshots or images and ask questions about them.

The system:

- Extracts readable text from the image using OCR
- Checks whether the image is related to the selected lesson or course
- Blocks unrelated image questions when the image does not match the current lesson context
- Answers using the uploaded image content and selected lesson/course boundaries

---

## Response Formatting

AI chat responses support readable markdown formatting, including:

- Headings
- Short paragraphs
- Bullet points
- Numbered lists
- Code blocks
- Inline code
- Markdown tables

This makes explanations easier to read and more useful for studying.

---

## Notes

- The backend runs on port `8011` by default.
- The frontend runs on port `5173` by default.
- Student chat answers are restricted to uploaded lesson/course materials.
- Image-based questions use OCR-extracted text and lesson relevance checks.
- AI responses can adapt to the student's selected teaching mode and tone.
- Teacher-generated lesson content should be reviewed before publishing.

---

## License

This project was developed as an academic AI-supported learning platform.