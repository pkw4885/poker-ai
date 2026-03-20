from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

router = APIRouter()


class CreateGameRequest(BaseModel):
    num_opponents: int = 1
    starting_stack: int = 1000
    small_blind: int = 5
    big_blind: int = 10


class CreateGameResponse(BaseModel):
    game_id: str
    message: str


@router.post("/create", response_model=CreateGameResponse)
async def create_game(request: CreateGameRequest):
    # TODO: Integrate with GameManager
    return CreateGameResponse(
        game_id="placeholder",
        message="Game creation will be implemented with the game engine",
    )


@router.websocket("/{game_id}/ws")
async def game_websocket(websocket: WebSocket, game_id: str):
    await websocket.accept()
    try:
        await websocket.send_json({"type": "connected", "game_id": game_id})
        while True:
            data = await websocket.receive_json()
            # TODO: Process game actions through GameManager
            await websocket.send_json({"type": "ack", "data": data})
    except WebSocketDisconnect:
        pass
