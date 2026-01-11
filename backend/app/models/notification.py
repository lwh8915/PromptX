"""
Notification model for user notifications.
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class NotificationCreate(BaseModel):
    """Schema for creating a notification."""
    user_id: str = Field(..., description="ID of the user to notify")
    type: Literal["review_reply", "review_like", "prompt_approved", "prompt_rejected"] = Field(..., description="Notification type")
    title: str = Field(..., max_length=100, description="Notification title")
    content: str = Field(..., max_length=500, description="Notification content")
    related_id: Optional[str] = Field(None, description="Related entity ID (review, prompt, etc.)")
    actor_name: Optional[str] = Field(None, description="Name of the user who triggered the notification")


class NotificationResponse(BaseModel):
    """Schema for notification response."""
    id: str
    user_id: str
    type: str
    title: str
    content: str
    related_id: Optional[str]
    actor_name: Optional[str]
    is_read: bool
    created_at: datetime


class NotificationListResponse(BaseModel):
    """Schema for notification list response."""
    items: list[NotificationResponse]
    total: int
    unread_count: int
