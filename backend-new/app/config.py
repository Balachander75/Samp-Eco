from pathlib import Path
from ipaddress import ip_network
from urllib.parse import urlsplit
from pydantic import field_validator
from pydantic_settings import BaseSettings
from typing import List

DEFAULT_DEV_SECRET = "navneet-samp-erp-super-secret-key-2026-production-level"
DEFAULT_DEV_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/samp_enterprise_db"

class Settings(BaseSettings):
    DATABASE_URL: str = DEFAULT_DEV_DATABASE_URL
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 5
    DB_POOL_TIMEOUT_SECONDS: int = 15
    WEB_CONCURRENCY: int = 1
    AUTO_SCHEMA_MIGRATION: bool = True
    TRUSTED_PROXY_IPS: List[str] = []
    ALLOWED_HOSTS: List[str] = ["*"]
    REFRESH_TOKEN_CLEANUP_INTERVAL_SECONDS: int = 3600
    REFRESH_TOKEN_RETENTION_DAYS: int = 14
    APP_NAME: str = "Navneet SAMP ERP API"
    APP_ENV: str = "development"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8002

    # JWT & Session configuration
    JWT_SECRET_KEY: str = DEFAULT_DEV_SECRET
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Rate Limiting
    RATE_LIMIT_LOGIN_MAX_ATTEMPTS: int = 5
    RATE_LIMIT_LOGIN_WINDOW_SECONDS: int = 60

    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176",
    ]

    @field_validator(
        "DB_POOL_SIZE",
        "DB_POOL_TIMEOUT_SECONDS",
        "WEB_CONCURRENCY",
        "JWT_ACCESS_TOKEN_EXPIRE_MINUTES",
        "JWT_REFRESH_TOKEN_EXPIRE_DAYS",
        "RATE_LIMIT_LOGIN_MAX_ATTEMPTS",
        "RATE_LIMIT_LOGIN_WINDOW_SECONDS",
        "REFRESH_TOKEN_CLEANUP_INTERVAL_SECONDS",
        "REFRESH_TOKEN_RETENTION_DAYS",
    )
    @classmethod
    def validate_positive_database_limits(cls, value: int) -> int:
        if value < 1:
            raise ValueError("Pool, token, rate-limit, and cleanup settings must be positive.")
        return value

    @field_validator("DB_MAX_OVERFLOW")
    @classmethod
    def validate_database_overflow(cls, value: int) -> int:
        if value < 0:
            raise ValueError("Database pool overflow cannot be negative.")
        return value

    @field_validator("TRUSTED_PROXY_IPS")
    @classmethod
    def validate_trusted_proxy_networks(cls, value: List[str]) -> List[str]:
        for network in value:
            ip_network(network, strict=False)
        return value

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug_setting(cls, value):
        if isinstance(value, str):
            normalized = value.strip().casefold()
            if normalized in {"release", "prod", "production", "false", "0", "no", "off"}:
                return False
            if normalized in {"debug", "development", "dev", "true", "1", "yes", "on"}:
                return True
        return value

    def validate_runtime_security(self):
        is_prod = self.APP_ENV.strip().lower() in ("production", "prod")
        if is_prod:
            if self.JWT_SECRET_KEY == DEFAULT_DEV_SECRET:
                raise ValueError("FATAL SECURITY ERROR: Running in production mode with default placeholder JWT_SECRET_KEY.")
            if len(self.JWT_SECRET_KEY) < 32:
                raise ValueError("FATAL SECURITY ERROR: JWT_SECRET_KEY in production must be at least 32 characters long.")
            if self.DATABASE_URL == DEFAULT_DEV_DATABASE_URL:
                raise ValueError("FATAL CONFIGURATION ERROR: DATABASE_URL must be explicitly configured in production.")
            if not self.DATABASE_URL.startswith(("postgresql://", "postgresql+psycopg2://")):
                raise ValueError("FATAL CONFIGURATION ERROR: Production DATABASE_URL must use PostgreSQL.")
            for origin in self.CORS_ORIGINS:
                parsed_origin = urlsplit(origin)
                try:
                    parsed_origin.port
                except ValueError as exc:
                    raise ValueError("FATAL CONFIGURATION ERROR: Production CORS_ORIGINS contains an invalid port.") from exc
                if (
                    parsed_origin.scheme != "https"
                    or not parsed_origin.hostname
                    or parsed_origin.hostname.lower() in {"localhost", "127.0.0.1", "::1"}
                    or parsed_origin.path != ""
                    or parsed_origin.query
                    or parsed_origin.fragment
                    or parsed_origin.username
                    or parsed_origin.password
                ):
                    raise ValueError("FATAL CONFIGURATION ERROR: Production CORS_ORIGINS must contain only valid HTTPS origins (or be empty for same-origin hosting).")
            normalized_hosts = [host.strip() for host in self.ALLOWED_HOSTS if host.strip()]
            if not normalized_hosts or any("*" in host for host in normalized_hosts):
                raise ValueError("FATAL CONFIGURATION ERROR: Production ALLOWED_HOSTS must explicitly list the service hostnames.")
            for host in normalized_hosts:
                parsed_host = urlsplit(f"//{host}")
                try:
                    has_port = parsed_host.port is not None
                except ValueError as exc:
                    raise ValueError("FATAL CONFIGURATION ERROR: ALLOWED_HOSTS contains an invalid port.") from exc
                if (
                    not parsed_host.hostname
                    or has_port
                    or parsed_host.path
                    or parsed_host.username
                    or parsed_host.password
                    or parsed_host.hostname.lower() in {"localhost", "127.0.0.1", "::1"}
                ):
                    raise ValueError("FATAL CONFIGURATION ERROR: ALLOWED_HOSTS entries must be valid production hostnames.")
            self.ALLOWED_HOSTS = normalized_hosts
            self.DEBUG = False
            # DDL and data backfills belong in a deployment migration step, not
            # in each API worker's startup path.
            self.AUTO_SCHEMA_MIGRATION = False

    class Config:
        env_file = Path(__file__).resolve().parents[1] / ".env"
        extra = "allow"

settings = Settings()
settings.validate_runtime_security()
