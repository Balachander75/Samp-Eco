import os
from pydantic import field_validator
from pydantic_settings import BaseSettings
from typing import List

DEFAULT_DEV_SECRET = "navneet-samp-erp-super-secret-key-2026-production-level"

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/navneet_samp"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT_SECONDS: int = 15
    APP_NAME: str = "Navneet SAMP ERP API"
    APP_ENV: str = "development"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8001

    # JWT & Session configuration
    JWT_SECRET_KEY: str = DEFAULT_DEV_SECRET
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15   # 15 minutes short-lived access token
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7      # 7 days refresh token

    # Rate Limiting
    RATE_LIMIT_LOGIN_MAX_ATTEMPTS: int = 5
    RATE_LIMIT_LOGIN_WINDOW_SECONDS: int = 60

    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5175",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5175",
    ]

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug_setting(cls, value):
        """Accept common deployment labels in DEBUG without failing startup."""
        if isinstance(value, str):
            normalized = value.strip().casefold()
            if normalized in {"release", "prod", "production", "false", "0", "no", "off"}:
                return False
            if normalized in {"debug", "development", "dev", "true", "1", "yes", "on"}:
                return True
        return value

    def validate_runtime_security(self):
        """Enforce strict production invariants."""
        is_prod = self.APP_ENV.lower() in ("production", "prod")
        if is_prod:
            if self.JWT_SECRET_KEY == DEFAULT_DEV_SECRET:
                raise ValueError(
                    "FATAL SECURITY ERROR: Running in production mode with default placeholder JWT_SECRET_KEY. "
                    "You must provide a high-entropy secret in your .env or environment variables."
                )
            if len(self.JWT_SECRET_KEY) < 32:
                raise ValueError(
                    "FATAL SECURITY ERROR: JWT_SECRET_KEY in production must be at least 32 characters long."
                )
            self.DEBUG = False

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
settings.validate_runtime_security()
