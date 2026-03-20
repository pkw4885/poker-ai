from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Poker AI API"
    debug: bool = False
    frontend_url: str = "http://localhost:3000"
    model_dir: str = "../../ai/models"

    class Config:
        env_file = ".env"


settings = Settings()
