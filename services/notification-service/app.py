from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from os import getenv
import logging
import base64
import json

# Configuration
SERVICE_NAME_VALUE = getenv("OTEL_SERVICE_NAME", "notification-service")
PORT = int(getenv("PORT", 3005))

# Setup logging (log4j-style pattern: timestamp - level - logger - message)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s.%(msecs)03d %(levelname)-5s [%(name)s] - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(SERVICE_NAME_VALUE)

# FastAPI app
app = FastAPI(title=SERVICE_NAME_VALUE, version="1.0.0")


# ── Centralized exception handling ─────────────────────────────────────────────
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception on %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse(status_code=500, content={"error": "Internal server error"})

# Models
class NotificationBase(BaseModel):
    user_id: int
    title: str
    message: str
    notification_type: str

class NotificationCreate(NotificationBase):
    pass

class NotificationResponse(NotificationBase):
    id: int
    read: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Mock database
notifications_db = {}
next_id = 1

def get_user_id_from_request(request: Request, query_user_id: Optional[int] = None) -> int:
    if query_user_id is not None:
        return query_user_id
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        try:
            parts = token.split(".")
            if len(parts) == 3:
                payload = parts[1]
                payload += "=" * (4 - len(payload) % 4)
                decoded = json.loads(base64.b64decode(payload).decode("utf-8"))
                uid = decoded.get("userId") or decoded.get("id") or decoded.get("sub")
                if uid:
                    return int(uid)
        except Exception as e:
            logger.warning("Failed to decode userId from Authorization token: %s", e)
    return 0

# Health check
@app.get("/health")
async def health():
    return {"status": "OK", "service": "notification-service"}

# Create notification
@app.post("/notifications", response_model=NotificationResponse)
async def create_notification(notification: NotificationCreate):
    global next_id
    notification_id = next_id
    next_id += 1
    
    db_notification = {
        "id": notification_id,
        **notification.dict(),
        "read": False,
        "created_at": datetime.utcnow()
    }
    notifications_db[notification_id] = db_notification
    logger.info(f"Notification created: {notification_id}")
    return db_notification

# Get notifications for user
@app.get("/notifications", response_model=List[NotificationResponse])
async def list_notifications(request: Request, user_id: Optional[int] = None, read: Optional[bool] = None):
    uid = get_user_id_from_request(request, user_id)
    user_notifications = [
        notif for notif in notifications_db.values() 
        if (uid == 0 or notif["user_id"] == uid) and (read is None or notif["read"] == read)
    ]
    return sorted(user_notifications, key=lambda x: x["created_at"], reverse=True)

# Mark notification as read
@app.put("/notifications/{notification_id}/read")
async def mark_as_read(notification_id: int):
    if notification_id not in notifications_db:
        logger.warning("Notification %s not found (mark_as_read)", notification_id)
        return {"error": "Notification not found"}, 404

    notifications_db[notification_id]["read"] = True
    logger.info("Notification %s marked as read", notification_id)
    return {"message": "Notification marked as read"}

# Delete notification
@app.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: int):
    if notification_id not in notifications_db:
        logger.warning("Notification %s not found (delete)", notification_id)
        return {"error": "Notification not found"}, 404

    del notifications_db[notification_id]
    logger.info("Notification %s deleted", notification_id)
    return {"message": "Notification deleted"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
