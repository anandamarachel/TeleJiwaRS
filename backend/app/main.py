from fastapi import FastAPI

from app.api.patients import router as patients_router

app = FastAPI(title="Telemedicine Jiwa")

app.include_router(patients_router)