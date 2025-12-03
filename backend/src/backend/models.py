from datetime import datetime
from typing import List, Optional

from sqlmodel import Field, Relationship, SQLModel


class Conversation(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.now)

    messages: List["Message"] = Relationship(back_populates="conversation")

class ConversationRead(SQLModel):
    id: int
    title: Optional[str]
    created_at: datetime
    messages: List["Message"]
    

class MessageRead(SQLModel):
    id: int
    role: str
    content: str
    created_at: datetime


class Message(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    conversation_id: Optional[int] = Field(
        default=None, foreign_key="conversation.id"
    )
    content: str
    role: str
    created_at: datetime = Field(default_factory=datetime.now)

    conversation: Optional[Conversation] = Relationship(
        back_populates="messages"
    )

class MessageCreate(SQLModel):
    role: str
    content: str
