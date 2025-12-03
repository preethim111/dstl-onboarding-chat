from contextlib import asynccontextmanager
from typing import List

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from sqlmodel import Session, select
from sqlalchemy.orm import selectinload

from .database import create_db_and_tables, get_session, seed_db
from .models import Conversation, ConversationRead, Message, MessageCreate, MessageRead

from .llm import generate_llm_response

import os
from pathlib import Path



@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    seed_db()
    yield


app = FastAPI(lifespan=lifespan)

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

if ENVIRONMENT == "production":
    # Directory: backend/src/backend/static
    static_dir = Path(__file__).resolve().parent / "static"
    app.mount("/app", StaticFiles(directory=static_dir, html=True), name="static")


# app.mount("/static", StaticFiles(directory="static"), name="static")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/conversations/", response_model=Conversation)
def create_conversation(
    conversation: Conversation, session: Session = Depends(get_session)
):
    session.add(conversation)
    session.commit()
    session.refresh(conversation)
    return conversation


@app.get("/conversations/", response_model=List[Conversation])
def read_conversations(
    offset: int = 0, limit: int = 100, session: Session = Depends(get_session)
):
    conversations = session.exec(
        select(Conversation).offset(offset).limit(limit)
    ).all()
    return conversations



@app.get("/conversations/{conversation_id}", response_model=ConversationRead)
def read_conversation(
    conversation_id: int, session: Session = Depends(get_session)
):
    statement = (
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.messages))
    )

    conversation = session.exec(statement).first()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return conversation



@app.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int, session: Session = Depends(get_session)
):
    conversation = session.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    session.delete(conversation)
    session.commit()
    return {"ok": True}


@app.post("/conversations/{conversation_id}/messages/", response_model=MessageRead)
def create_message(
    conversation_id: int,
    message: MessageCreate,
    session: Session = Depends(get_session),
):
    # 1. Make sure the conversation exists
    conversation = session.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # 2. Save the user message
    user_message = Message(
        role=message.role,
        content=message.content,
        conversation_id=conversation_id,
    )
    session.add(user_message)
    session.commit()
    session.refresh(user_message)

    # 3. Build full conversation history
    history_stmt = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    history_messages = session.exec(history_stmt).all()
    llm_messages = [
        {"role": m.role, "content": m.content} for m in history_messages
    ]

    # 4. Call LLM (but don't crash if it fails)
    try:
        assistant_text = generate_llm_response(llm_messages)
    except Exception as e:
        print("LLM error:", e)
        assistant_text = "Sorry, I had an error generating a response."

    # 5. Save assistant message
    assistant_message = Message(
        role="assistant",
        content=assistant_text,
        conversation_id=conversation_id,
    )
    session.add(assistant_message)
    session.commit()
    session.refresh(assistant_message)

    # 6. Return assistant message to the frontend
    return assistant_message