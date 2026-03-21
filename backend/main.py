import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
from dotenv import load_dotenv

# 1. Import the new Google GenAI SDK
from google import genai
from google.genai import types

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Initialize the Gemini Client
# It automatically picks up GEMINI_API_KEY from your .env file
client = genai.Client()

# --- Pydantic Models ---
class Exam(BaseModel):
    name: str
    date: str
    subjects: str

class PlanRequest(BaseModel):
    exams: List[dict]
    subjects: List[str]
    subject_evaluations: Dict[str, str]  # e.g., {"Math": "Poor - Needs Heavy Focus"}
    course_difficulties: List[dict]
    hours_per_day: float

class ChatRequest(BaseModel):
    message: str

class QuizRequest(BaseModel):
    subjects: List[str]

# --- Endpoints ---
@app.post("/api/generate-plan")
async def generate_plan(request: PlanRequest):
    if not os.getenv("GEMINI_API_KEY"):
        raise HTTPException(status_code=500, detail="Gemini API Key is missing.")

    # System Prompt (Becomes the system_instruction in Gemini)
    system_prompt = (
        "You are an elite, highly structured academic study planner AI. "
        "Your sole task is to generate a realistic, daily study schedule. "
        "Format your output ENTIRELY in beautiful, structured Markdown. "
        "Strict rules: "
        "- Analyze the upcoming exams and the available study hours per day. "
        "- Distribute chunked study sessions intelligently. "
        "- CRITICAL: Look closely at the 'Subject Knowledge Evaluations'. If a student scored poorly in a subject on their diagnostic quiz, allocate significantly more review time for it. "
        "- CRITICAL: You MUST explicitly schedule dedicated 'Revision Slots' for subjects tied to upcoming exams and overall structured review. "
        "- Keep the formatting clean, using Markdown (bolding, bullet points, and clear day headers). "
        "- Make sure to keep the response easy to read and understand."
    )

    # User Prompt
    user_prompt = f"""
    Create a detailed daily study plan using these exact constraints:
    - Upcoming Exams: {request.exams}
    - Subjects (Inputs): {request.subjects}
    - Subject Knowledge Evaluations (from their trivia quiz): {request.subject_evaluations}
    - Course Difficulties: {request.course_difficulties}
    - Hours available per day: {request.hours_per_day}
    """

    try:
        # 3. Call Gemini asynchronously using client.aio
        # We'll use gemini-2.5-flash as it is extremely fast and capable
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.4, # Lowered slightly for more concise, structured output
                max_output_tokens=8000, # Massively increased so it never cuts off
            )
        )
        
        # 4. Return the generated text to React
        return {"plan": response.text}

    except Exception as e:
        print(f"Gemini Error: {e}")
        raise HTTPException(status_code=500, detail="The AI engine failed to generate a plan.")

# --- Chatbot Endpoint ---
@app.post("/api/chat")
async def chat_with_ai(chat_req: ChatRequest):
    if not os.getenv("GEMINI_API_KEY"):
        raise HTTPException(status_code=500, detail="Gemini API Key is missing.")
    
    chat_system_prompt = (
        "You are an encouraging, expert AI study coach. "
        "Provide concise, actionable study tips, motivation, and answers to student queries. "
        "Keep responses friendly and formatted in clean Markdown."
    )
    
    try:
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=chat_req.message,
            config=types.GenerateContentConfig(
                system_instruction=chat_system_prompt,
                temperature=0.6,
                max_output_tokens=1000,
            )
        )
        return {"reply": response.text}
    except Exception as e:
        print("Error connecting to Gemini Chat API:", e)
        raise HTTPException(status_code=500, detail="Error communicating with AI Chat service")

@app.post("/api/generate-quiz")
async def generate_quiz(request: QuizRequest):
    if not request.subjects:
        raise HTTPException(status_code=400, detail="No subjects provided for the quiz.")
        
    system_prompt = (
        "You are a strict Trivia Quiz Generator. Your goal is to test a student's knowledge across specific subjects. "
        "You MUST generate EXACTLY 10 questions in total, distributing equal importance across the provided subjects. "
        "Mix Multiple Choice Questions (MCQ) and Fill in the Blanks. "
        "Difficulty should be a mix of Easy and Medium. "
        "CRITICAL INSTRUCTION: You MUST return raw JSON. Do not return markdown blocks like ```json. "
        "Your response must be a single array of objects with the exact schema:\n"
        "[\n"
        "  {\n"
        '    "subject": "Math",\n'
        '    "type": "mcq",\n'
        '    "question": "What is 2+2?",\n'
        '    "options": ["1", "3", "4", "5"],\n'
        '    "answer": "4"\n'
        "  },\n"
        "  {\n"
        '    "subject": "Physics",\n'
        '    "type": "fill_in_the_blank",\n'
        '    "question": "F = m * _",\n'
        '    "options": [],\n'
        '    "answer": "a"\n'
        "  }\n"
        "]"
    )

    user_prompt = f"Subjects to cover: {', '.join(request.subjects)}"

    try:
        response = await client.aio.models.generate_content(
            model='gemini-2.5-flash',
            contents=[system_prompt, user_prompt],
            config=types.GenerateContentConfig(
                temperature=0.7,
                response_mime_type="application/json"
            )
        )
        return {"quiz_data": response.text} # This will be stringified JSON
    except Exception as e:
        print("Error generating quiz:", e)
        raise HTTPException(status_code=500, detail="Error generating trivia quiz")