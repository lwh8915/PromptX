"""
Notifications API router with REST endpoints and WebSocket support.
"""
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query
from bson import ObjectId
from datetime import datetime
from typing import Optional
import json
import asyncio

from ..database import get_collection
from ..services.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


# WebSocket Connection Manager
class ConnectionManager:
    """Manager for WebSocket connections."""
    
    def __init__(self):
        # Map of user_id -> list of WebSocket connections
        self.active_connections: dict[str, list[WebSocket]] = {}
        self._lock = asyncio.Lock()
    
    async def connect(self, websocket: WebSocket, user_id: str):
        """Accept and store a new WebSocket connection."""
        await websocket.accept()
        async with self._lock:
            if user_id not in self.active_connections:
                self.active_connections[user_id] = []
            self.active_connections[user_id].append(websocket)
        print(f"[WS] User {user_id} connected. Total connections: {len(self.active_connections.get(user_id, []))}")
    
    async def disconnect(self, websocket: WebSocket, user_id: str):
        """Remove a WebSocket connection."""
        async with self._lock:
            if user_id in self.active_connections:
                if websocket in self.active_connections[user_id]:
                    self.active_connections[user_id].remove(websocket)
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
        print(f"[WS] User {user_id} disconnected.")
    
    async def send_to_user(self, user_id: str, message: dict):
        """Send a message to all connections of a specific user."""
        if user_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"[WS] Error sending to {user_id}: {e}")
                    disconnected.append(connection)
            # Clean up failed connections
            for conn in disconnected:
                await self.disconnect(conn, user_id)
    
    def is_online(self, user_id: str) -> bool:
        """Check if a user is currently online."""
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0


# Global connection manager instance
manager = ConnectionManager()


def serialize_notification(notification: dict) -> dict:
    """Serialize notification from MongoDB document to response dict."""
    return {
        "id": str(notification["_id"]),
        "user_id": str(notification["user_id"]),
        "type": notification.get("type", ""),
        "title": notification.get("title", ""),
        "content": notification.get("content", ""),
        "related_id": str(notification["related_id"]) if notification.get("related_id") else None,
        "actor_name": notification.get("actor_name"),
        "is_read": notification.get("is_read", False),
        "created_at": notification.get("created_at", datetime.utcnow())
    }


async def create_notification(
    user_id: str,
    notification_type: str,
    title: str,
    content: str,
    related_id: str = None,
    actor_name: str = None
) -> dict:
    """Create a notification and push it via WebSocket if user is online."""
    collection = get_collection("notifications")
    
    now = datetime.utcnow()
    new_notification = {
        "user_id": ObjectId(user_id),
        "type": notification_type,
        "title": title,
        "content": content,
        "related_id": ObjectId(related_id) if related_id else None,
        "actor_name": actor_name,
        "is_read": False,
        "created_at": now
    }
    
    result = await collection.insert_one(new_notification)
    new_notification["_id"] = result.inserted_id
    
    # Serialize and send via WebSocket
    serialized = serialize_notification(new_notification)
    await manager.send_to_user(user_id, {
        "type": "new_notification",
        "notification": serialized
    })
    
    return serialized


# WebSocket endpoint
@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """WebSocket endpoint for real-time notifications."""
    await manager.connect(websocket, user_id)
    try:
        while True:
            # Keep connection alive, handle incoming messages (ping/pong)
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await manager.disconnect(websocket, user_id)
    except Exception as e:
        print(f"[WS] Error: {e}")
        await manager.disconnect(websocket, user_id)


@router.get("", response_model=dict)
async def get_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    current_user: dict = Depends(get_current_user)
):
    """Get notifications for the current user."""
    collection = get_collection("notifications")
    user_id = ObjectId(current_user["id"])
    
    query = {"user_id": user_id}
    if unread_only:
        query["is_read"] = False
    
    skip = (page - 1) * page_size
    
    total = await collection.count_documents(query)
    unread_count = await collection.count_documents({"user_id": user_id, "is_read": False})
    
    cursor = collection.find(query).sort("created_at", -1).skip(skip).limit(page_size)
    
    notifications = []
    async for notification in cursor:
        notifications.append(serialize_notification(notification))
    
    return {
        "items": notifications,
        "total": total,
        "unread_count": unread_count
    }


@router.get("/unread-count", response_model=dict)
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    """Get unread notification count."""
    collection = get_collection("notifications")
    user_id = ObjectId(current_user["id"])
    
    count = await collection.count_documents({"user_id": user_id, "is_read": False})
    
    return {"unread_count": count}


@router.post("/{notification_id}/read", response_model=dict)
async def mark_as_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark a notification as read."""
    collection = get_collection("notifications")
    user_id = ObjectId(current_user["id"])
    
    result = await collection.update_one(
        {"_id": ObjectId(notification_id), "user_id": user_id},
        {"$set": {"is_read": True}}
    )
    
    if result.matched_count == 0:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="通知不存在")
    
    return {"message": "已标记为已读", "id": notification_id}


@router.post("/read-all", response_model=dict)
async def mark_all_as_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read."""
    collection = get_collection("notifications")
    user_id = ObjectId(current_user["id"])
    
    result = await collection.update_many(
        {"user_id": user_id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    
    return {"message": "已全部已读", "updated_count": result.modified_count}


@router.delete("/{notification_id}", response_model=dict)
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a notification."""
    collection = get_collection("notifications")
    user_id = ObjectId(current_user["id"])
    
    result = await collection.delete_one(
        {"_id": ObjectId(notification_id), "user_id": user_id}
    )
    
    if result.deleted_count == 0:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="通知不存在")
    
    return {"message": "删除成功", "id": notification_id}
