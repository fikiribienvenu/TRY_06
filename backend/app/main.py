from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from loguru import logger
from pathlib import Path
import sys

from app.config import settings
from app.database import connect_db, disconnect_db
from app.routers import auth, users, patients, ct_scans, reports, appointments, analytics, notifications
from app.routers import schedule, predictions


# Configure loguru
logger.remove()
logger.add(sys.stdout, format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}", level="DEBUG" if settings.DEBUG else "INFO")
logger.add("logs/pulmoscan.log", rotation="10 MB", retention="30 days", level="INFO")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Path("logs").mkdir(exist_ok=True)
    Path("uploads/ct_scans").mkdir(parents=True, exist_ok=True)
    Path("uploads/heatmaps").mkdir(parents=True, exist_ok=True)
    Path("uploads/reports").mkdir(parents=True, exist_ok=True)

    await connect_db()
    await _bootstrap_director()

    # Pre-load AI model
    from app.ai.model_loader import load_model
    load_model()

    logger.success(f"{settings.APP_NAME} started in {settings.ENVIRONMENT} mode")
    yield

    # Shutdown
    await disconnect_db()
    logger.info("Shutdown complete")


async def _bootstrap_director():
    from app.models.user import User, UserRole
    from app.core.security import hash_password, verify_password
    existing = await User.find_one(User.role == UserRole.DIRECTOR)
    if not existing:
        director = User(
            email=settings.DIRECTOR_EMAIL,
            hashed_password=hash_password(settings.DIRECTOR_DEFAULT_PASSWORD),
            first_name=settings.DIRECTOR_FIRST_NAME,
            last_name=settings.DIRECTOR_LAST_NAME,
            role=UserRole.DIRECTOR,
            must_change_password=False,
            is_active=True,
        )
        await director.insert()
        logger.success(f"Director account bootstrapped: {settings.DIRECTOR_EMAIL}")
    else:
        # Keep credentials in sync with .env — allows password reset by restarting
        if not verify_password(settings.DIRECTOR_DEFAULT_PASSWORD, existing.hashed_password):
            existing.hashed_password = hash_password(settings.DIRECTOR_DEFAULT_PASSWORD)
            existing.email = settings.DIRECTOR_EMAIL
            await existing.save()
            logger.info(f"Director credentials synced from .env: {settings.DIRECTOR_EMAIL}")


app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered lung cancer prediction system via CT scan analysis",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# Middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.debug(f"{request.method} {request.url.path}")
    response = await call_next(request)
    return response


# Static files
uploads_path = Path("uploads")
uploads_path.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Routers
API = "/api/v1"
app.include_router(auth.router, prefix=API)
app.include_router(users.router, prefix=API)
app.include_router(patients.router, prefix=API)
app.include_router(ct_scans.router, prefix=API)
app.include_router(reports.router, prefix=API)
app.include_router(appointments.router, prefix=API)
app.include_router(analytics.router, prefix=API)
app.include_router(notifications.router, prefix=API)
app.include_router(schedule.router, prefix=API)
app.include_router(predictions.router, prefix=API)


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
