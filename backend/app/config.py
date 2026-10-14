"""Validated runtime configuration. Secrets only come from the environment."""
from pathlib import Path

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_TOKEN_FILE = Path(__file__).resolve().parents[2] / ".orbit-token"  # repo root


def _alias(name: str, field: str) -> AliasChoices:
    return AliasChoices(name, field)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"), extra="ignore", populate_by_name=True
    )
    database_url: str = Field("sqlite:///./orbit.db", validation_alias=_alias("ORBIT_DATABASE_URL", "database_url"))
    nebius_api_key: str | None = Field(None, validation_alias=_alias("NEBIUS_API_KEY", "nebius_api_key"))
    nebius_base_url: str = Field(
        "https://api.tokenfactory.nebius.com/v1/", validation_alias=_alias("NEBIUS_BASE_URL", "nebius_base_url")
    )
    # UNVERIFIED default: confirm with `python scripts/list_models.py` before relying on it.
    nebius_model: str = Field("nvidia/Nemotron-3-Nano-30B-A3B", validation_alias=_alias("NEBIUS_MODEL", "nebius_model"))
    demo_mode: bool = Field(False, validation_alias=_alias("ORBIT_DEMO_MODE", "demo_mode"))
    allowed_origins: str = Field(
        "http://localhost:5173,http://127.0.0.1:5173", validation_alias=_alias("ORBIT_ALLOWED_ORIGINS", "allowed_origins")
    )
    max_file_bytes: int = Field(200_000, ge=1_000, le=5_000_000, validation_alias=_alias("ORBIT_MAX_FILE_BYTES", "max_file_bytes"))
    max_context_chars: int = Field(24_000, ge=1_000, le=200_000)
    provider_timeout_s: float = Field(90.0, gt=0)
    provider_max_tokens: int = Field(4096, ge=256, le=32_768, validation_alias=_alias("NEBIUS_MAX_TOKENS", "provider_max_tokens"))
    # Ask the model which skill fits when the user didn't pick one (AI-03). Off by default: it costs an extra call.
    model_routing: bool = Field(False, validation_alias=_alias("ORBIT_MODEL_ROUTING", "model_routing"))
    # Extra model calls allowed to repair a reply that doesn't match the skill's schema (AI-02).
    repair_retries: int = Field(1, ge=0, le=2, validation_alias=_alias("ORBIT_REPAIR_RETRIES", "repair_retries"))
    history_messages: int = Field(6, ge=0, le=20)
    chat_rate_limit: int = Field(30, ge=1, le=1000, validation_alias=_alias("ORBIT_CHAT_RATE_LIMIT", "chat_rate_limit"))  # model calls per minute
    # Local API token (SEC-01). Unset: a random token is generated at startup and written to token_file,
    # where the Vite proxy reads it. The browser never sees it.
    api_token: str | None = Field(None, validation_alias=_alias("ORBIT_API_TOKEN", "api_token"))
    token_file: str = Field(str(DEFAULT_TOKEN_FILE), validation_alias=_alias("ORBIT_TOKEN_FILE", "token_file"))

    @field_validator("nebius_base_url")
    @classmethod
    def _https_only(cls, v: str) -> str:
        if not (v.startswith("https://") or v.startswith("http://localhost") or v.startswith("http://127.0.0.1")):
            raise ValueError("NEBIUS_BASE_URL must use https:// (http only allowed for localhost)")
        return v

    @field_validator("api_token")
    @classmethod
    def _token_strength(cls, v: str | None) -> str | None:
        v = v.strip() if v else None
        if v and len(v) < 24:
            raise ValueError("ORBIT_API_TOKEN must be at least 24 characters (or leave it unset to generate one)")
        return v

    @field_validator("nebius_api_key")
    @classmethod
    def _blank_key_is_none(cls, v: str | None) -> str | None:
        return v.strip() or None if v else None

    @property
    def origins(self) -> list[str]:
        origins = [o.strip() for o in self.allowed_origins.split(",") if o.strip()]
        if "*" in origins:
            raise ValueError("Wildcard CORS origin is not allowed")
        return origins
