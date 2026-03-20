import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from routers import auth, game, guide, health, rooms, ws

app = FastAPI(
    title="Poker AI API",
    description="Texas Hold'em Poker AI System",
    version="0.1.0",
)

allowed_origins = [
    "http://localhost:3000",
]

# Add configured frontend URL
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    allowed_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(game.router, prefix="/api/game", tags=["game"])
app.include_router(guide.router, prefix="/api/guide", tags=["guide"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(rooms.router, prefix="/api/rooms", tags=["rooms"])
app.include_router(ws.router, prefix="/ws", tags=["websocket"])


@app.on_event("startup")
async def startup() -> None:
    init_db()
