from fastapi import FastAPI

from app.api.patients import router as patients_router
from app.api.auth import router as auth_router
from app.api.staff import router as staff_router
from app.api.consultations import router as consulatation_router
from app.api.admin import router as admin_router
from app.api.doctor import router as doctor_router
from app.api.chat import router as chat_router

from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from app.core.config import settings
from app.core.http_security import OriginValidationMiddleware, SecurityHeadersMiddleware
from app.core.rate_limit import SensitiveEndpointRateLimitMiddleware

app = FastAPI(
    title="Telemedicine Jiwa",
    docs_url=None if settings.environment == "production" else "/docs",
    redoc_url=None if settings.environment == "production" else "/redoc",
    openapi_url=None if settings.environment == "production" else "/openapi.json",
)

app.include_router(patients_router)
app.include_router(auth_router)
app.include_router(staff_router)
app.include_router(consulatation_router)
app.include_router(admin_router)
app.include_router(doctor_router)
app.include_router(chat_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)
app.add_middleware(OriginValidationMiddleware)
app.add_middleware(SensitiveEndpointRateLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_host_list)
