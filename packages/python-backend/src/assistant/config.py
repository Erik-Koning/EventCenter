"""Configuration settings loaded from environment variables."""

from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings from environment variables."""

    # Azure OpenAI Configuration
    azure_openai_api_key: str = ""
    azure_openai_endpoint: str = ""
    azure_openai_deployment: str = "gpt-4o"
    azure_openai_api_version: str = "2024-08-01-preview"

    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    # CORS Configuration
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Database Configuration
    database_url: str = ""
    db_user: str = ""
    db_key: str = ""
    db_server: str = ""
    db_port: str = "5432"
    db_name: str = ""
    db_ssl: str = "true"

    @staticmethod
    def _strip_sslmode(url: str) -> str:
        """Remove sslmode query param — asyncpg doesn't accept it; SSL is
        configured via connect_args in engine.py instead."""
        parsed = urlparse(url)
        if not parsed.query:
            return url
        params = parse_qs(parsed.query)
        params.pop("sslmode", None)
        new_query = urlencode(params, doseq=True)
        return urlunparse(parsed._replace(query=new_query))

    @property
    def async_database_url(self) -> str:
        """Build async PostgreSQL URL for asyncpg driver."""
        if self.database_url:
            # Convert postgresql:// to postgresql+asyncpg://
            url = self.database_url
            if url.startswith("postgresql://"):
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            elif url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+asyncpg://", 1)
            return self._strip_sslmode(url)

        if self.db_server:
            port = self.db_port or "5432"
            return (
                f"postgresql+asyncpg://{self.db_user}:{self.db_key}"
                f"@{self.db_server}:{port}/{self.db_name}"
            )

        return ""

    class Config:
        env_file = "../../.env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
