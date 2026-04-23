# AI-Supported-Learning-System

A role-based learning platform where teachers can create courses, upload lesson materials, generate and refine AI-supported lesson explanations, and publish them for students. Students can access published lessons, explore uploaded course materials, and ask lesson-based questions using different response modes and teaching tones to support a more personalized learning experience.

## Features

### Teacher
- Create courses
- Upload course materials
- Upload lesson PDFs
- Generate AI-supported lesson previews
- Give feedback and improve generated explanations
- Approve and publish lessons

### Student
- View available courses
- Access published lessons
- Start lesson-based chats
- Study AI-generated explanations

## Tech Stack

- **Backend:** FastAPI, SQLAlchemy, PostgreSQL
- **Frontend:** Vite, TypeScript
- **AI / RAG:** Ollama, ChromaDB, sentence-transformers
- **Auth:** JWT

## Project Structure

```text
AI-Supported-Learning-System/
├── backend/
│   ├── api/
│   ├── core/
│   ├── models/
│   ├── schemas/
│   ├── services/
│   ├── main.py
│   ├── database.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
└── README.md

```
## Prerequisites

Make sure these are installed:

- Python
- Node.js
- PostgreSQL
- pgAdmin 


## Database Setup

Create a PostgreSQL database named:

```text
ai_learning
```
## Backend Setup
Go to the backend folder:

```text
cd backend
```
Create and activate a virtual environment.
Install dependencies:

```text
pip install -r requirements.txt
```

Create a .env file inside the backend folder.

Start the backend:
```text
uvicorn main:app --reload --port 8011
```

Backend will run at:
```text
http://127.0.0.1:8011
```

Swagger docs:
```text
http://127.0.0.1:8011/docs
```
## Frontend Setup
Open a new terminal and go to the frontend folder, install dependencies, start the frontend respectively:
```text
cd frontend
npm install
npm install framer-motion
npm install lucide-react
npm run dev
```

Frontend will usually run at:
```text
http://localhost:5173
```
