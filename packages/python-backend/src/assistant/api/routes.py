"""API route definitions."""

from fastapi import APIRouter

from .chat import router as chat_router
from .endpoints.goals import router as goals_router
from .endpoints.updates import router as updates_router
from .endpoints.events import router as events_router

router = APIRouter(prefix="/api/v1")

# Include sub-routers
router.include_router(chat_router, tags=["chat"])
router.include_router(goals_router)
router.include_router(updates_router)
router.include_router(events_router)
