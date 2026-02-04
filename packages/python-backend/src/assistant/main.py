"""FastAPI application entrypoint."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import router
from .config import settings
from .schemas import HealthResponse
from .db.engine import async_engine

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup/shutdown."""
    # Startup
    logger.info("Starting Chat Assistant API...")
    logger.info(f"CORS origins: {settings.cors_origins}")

    if async_engine:
        logger.info("Database engine initialized")
    else:
        logger.warning("No database URL configured - DB features disabled")

    yield

    # Shutdown
    logger.info("Shutting down Chat Assistant API...")
    if async_engine:
        await async_engine.dispose()
        logger.info("Database engine disposed")


# Create FastAPI app with lifespan
app = FastAPI(
    title="Chat Assistant API",
    description="LangGraph-powered assistant for commuter information in the GTA",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router)


@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(status="ok", version="0.1.0")
