import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
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

class SubjectStrength(BaseModel):
    subject: str
    strength: str 

class CourseDifficulty(BaseModel):
    course: str
    difficulty: str 

class StudyPreferences(BaseModel):
    exams: List[Exam]
    subject_strengths: List[SubjectStrength]
    course_difficulties: List[CourseDifficulty]
    hours_per_day: float

# --- The API Endpoint ---
@app.post("/api/generate-plan")
async def generate_plan(prefs: StudyPreferences):
    if not os.getenv("GEMINI_API_KEY"):
        raise HTTPException(status_code=500, detail="Gemini API Key is missing.")

    # System Prompt (Becomes the system_instruction in Gemini)
    system_prompt = (
        "You are an expert, highly organized AI study architect. Your goal is to create "
        "a practical, day-by-day weekly study plan tailored to the user's specific constraints.\n\n"
        "Core Directives:\n"
        "- Distribute the available daily study time logically.\n"
        "- Prioritize subjects tied to upcoming exams, heavily weighting those with closer dates.\n"
        "- Allocate extra time and foundational concept-building for 'Weak' subjects and 'Hard' courses.\n"
        "- Schedule lighter revision and practice sessions for 'Strong' subjects.\n"
        "- Keep the formatting clean, using Markdown (bolding, bullet points, and clear day headers)."
    )

    # User Prompt
    exams_text = "\n".join([f"- {e.name} on {e.date} (Covers: {e.subjects})" for e in prefs.exams]) or "None"
    strengths_text = "\n".join([f"- {s.subject}: {s.strength}" for s in prefs.subject_strengths]) or "None"
    difficulty_text = "\n".join([f"- {c.course}: {c.difficulty}" for c in prefs.course_difficulties]) or "None"

    user_prompt = (
        f"I have {prefs.hours_per_day} hours available to study per day.\n\n"
        f"Upcoming Exams:\n{exams_text}\n\n"
        f"My Subject Strengths:\n{strengths_text}\n\n"
        f"Course Difficulties:\n{difficulty_text}\n\n"
        "Please generate my week-long study plan based on this data."
    )

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