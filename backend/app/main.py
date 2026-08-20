from fastapi import FastAPI

from app.api.patients import router as patients_router
from app.api.auth import router as auth_router
from app.api.staff import router as staff_router
from app.api.consultations import router as consulatation_router
from app.api.admin import router as admin_router
from app.api.doctor import router as doctor_router
from app.api.chat import router as chat_router

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Telemedicine Jiwa")

app.include_router(patients_router)
app.include_router(auth_router)
app.include_router(staff_router)
app.include_router(consulatation_router)
app.include_router(admin_router)
app.include_router(doctor_router)
app.include_router(chat_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)