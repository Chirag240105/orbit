"""Validated runtime configuration. Secrets only come from the environment."""
from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    @field_validator("nebius_base_url")
    @classmethod
    def _https_only(cls, v: str) -> str:
        if not (v.startswith("https://") or v.startswith("http://localhost") or v.startswith("http://127.0.0.1")):
            raise ValueError("NEBIUS_BASE_URL must use https:// (http only allowed for localhost)")
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
