from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import game, guide, health

app = FastAPI(
    title="Poker AI API",
    description="Texas Hold'em Poker AI System",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(game.router, prefix="/api/game", tags=["game"])
app.include_router(guide.router, prefix="/api/guide", tags=["guide"])
