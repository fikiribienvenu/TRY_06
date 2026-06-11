from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from beanie import init_beanie
from loguru import logger
from app.config import settings


client: AsyncIOMotorClient = None
db: AsyncIOMotorDatabase = None


async def connect_db():
    global client, db
    logger.info("Connecting to MongoDB...")
    client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=30000)
    db = client[settings.DB_NAME]

    from app.models.user import User
    from app.models.patient import Patient
    from app.models.ct_scan import CTScan
    from app.models.prediction import Prediction
    from app.models.report import Report
    from app.models.appointment import Appointment
    from app.models.notification import Notification
    from app.models.audit_log import AuditLog
    from app.models.activity import Activity
    from app.models.schedule import ScheduleSlot

    await init_beanie(
        database=db,
        document_models=[
            User, Patient, CTScan, Prediction, Report,
            Appointment, Notification, AuditLog, Activity, ScheduleSlot,
        ],
    )
    logger.success("Connected to MongoDB")


async def disconnect_db():
    global client
    if client:
        client.close()
        logger.info("Disconnected from MongoDB")


def get_database() -> AsyncIOMotorDatabase:
    return db
