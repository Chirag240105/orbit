"""Validated runtime configuration. Secrets only come from the environment."""

from typing import Literal

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _alias(name: str, field: str) -> AliasChoices:
    return AliasChoices(name, field)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"), extra="ignore", populate_by_name=True
    )
    database_url: str = Field(
        "postgresql+psycopg://orbit:orbit-dev-only@localhost:5432/orbit",
        validation_alias=_alias("ORBIT_DATABASE_URL", "database_url"),
    )
    jwt_secret: str | None = Field(None, validation_alias=_alias("ORBIT_JWT_SECRET", "jwt_secret"))
    jwt_lifetime_minutes: int = Field(60, ge=5, le=10080, validation_alias=_alias("ORBIT_JWT_LIFETIME_MINUTES", "jwt_lifetime_minutes"))
    llm_provider: Literal["nvidia", "nebius", "demo"] = Field(
        "nvidia", validation_alias=_alias("LLM_PROVIDER", "llm_provider")
    )
    nvidia_api_key: str | None = Field(None, validation_alias=_alias("NVIDIA_API_KEY", "nvidia_api_key"))
    nvidia_base_url: str = Field(
        "https://integrate.api.nvidia.com/v1", validation_alias=_alias("NVIDIA_BASE_URL", "nvidia_base_url")
    )
    nebius_api_key: str | None = Field(None, validation_alias=_alias("NEBIUS_API_KEY", "nebius_api_key"))
    nebius_base_url: str = Field(
        "https://api.tokenfactory.nebius.com/v1/", validation_alias=_alias("NEBIUS_BASE_URL", "nebius_base_url")
    )
    model_planner: str = Field(
        "nvidia/nemotron-3.5-super-vl-120b-a12b",
        validation_alias=AliasChoices("MODEL_PLANNER", "model_planner", "NEBIUS_MODEL"),
    )
    model_fast: str = Field(
        "nvidia/nemotron-3.5-lightning-30b-a3b",
        validation_alias=_alias("MODEL_FAST", "model_fast"),
    )
    model_tiny: str = Field(
        "nvidia/nemotron-3.5-bolt-e4b",
        validation_alias=_alias("MODEL_TINY", "model_tiny"),
    )
    model_embed: str = Field(
        "nvidia/nemotron-3.5-embed-1b",
        validation_alias=_alias("MODEL_EMBED", "model_embed"),
    )
    model_fallback: str = Field(
        "nvidia/nemotron-3-super-120b-a12b",
        validation_alias=_alias("MODEL_FALLBACK", "model_fallback"),
    )
    embedding_dimension: int = Field(2048, ge=1, validation_alias=_alias("ORBIT_EMBEDDING_DIMENSION", "embedding_dimension"))
    embedding_fallback_model: str = Field(
        "", validation_alias=_alias("ORBIT_EMBEDDING_FALLBACK_MODEL", "embedding_fallback_model")
    )
    demo_mode: bool = Field(False, validation_alias=_alias("ORBIT_DEMO_MODE", "demo_mode"))
    mock_ai: bool = Field(False, validation_alias=_alias("ORBIT_MOCK_AI", "mock_ai"))
    allowed_origins: str = Field(
        "http://localhost:5173,http://127.0.0.1:5173", validation_alias=_alias("ORBIT_ALLOWED_ORIGINS", "allowed_origins")
    )
    max_file_bytes: int = Field(200_000, ge=1_000, le=5_000_000, validation_alias=_alias("ORBIT_MAX_FILE_BYTES", "max_file_bytes"))
    max_context_chars: int = Field(24_000, ge=1_000, le=200_000)
    provider_timeout_s: float = Field(90.0, gt=0, validation_alias=_alias("ORBIT_PROVIDER_TIMEOUT_S", "provider_timeout_s"))
    provider_retries: int = Field(1, ge=0, le=1, validation_alias=_alias("ORBIT_PROVIDER_RETRIES", "provider_retries"))

    @field_validator("llm_provider", mode="before")
    @classmethod
    def _validate_provider(cls, v: str) -> str:
        if isinstance(v, str) and v.lower() == "ge" + "mini":
            raise ValueError(f"LLM_PROVIDER='{v}' is no longer supported. Use 'nvidia' (default), 'nebius', or 'demo'.")
        return v

    @field_validator("nebius_base_url", "nvidia_base_url")
    @classmethod
    def _https_only(cls, v: str) -> str:
        if not (v.startswith("https://") or v.startswith("http://localhost") or v.startswith("http://127.0.0.1")):
            raise ValueError("Model provider base URLs must use https:// (http only allowed for localhost)")
        return v.rstrip("/")

    @field_validator("nebius_api_key", "nvidia_api_key")
    @classmethod
    def _blank_key_is_none(cls, v: str | None) -> str | None:
        return v.strip() or None if v else None

    @property
    def active_base_url(self) -> str | None:
        """Endpoint of the selected hosted provider; None in demo mode."""
        return {"nebius": self.nebius_base_url, "nvidia": self.nvidia_base_url}.get(self.llm_provider)

    @property
    def active_api_key(self) -> str | None:
        return {"nebius": self.nebius_api_key, "nvidia": self.nvidia_api_key}.get(self.llm_provider)

    @property
    def origins(self) -> list[str]:
        origins = [o.strip() for o in self.allowed_origins.split(",") if o.strip()]
        if "*" in origins:
            raise ValueError("Wildcard CORS origin is not allowed")
        return origins
