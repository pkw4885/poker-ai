from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class GuideRequest(BaseModel):
    hole_cards: list[str]
    position: str
    board: list[str] = []
    pot_size: float = 0
    num_opponents: int = 1
    stack_size: float = 100


class GuideResponse(BaseModel):
    recommended_action: str
    confidence: float
    ev_analysis: dict


@router.post("/recommend", response_model=GuideResponse)
async def get_recommendation(request: GuideRequest):
    # TODO: Integrate with AI engine for recommendations
    return GuideResponse(
        recommended_action="fold",
        confidence=0.0,
        ev_analysis={"message": "AI engine not yet integrated"},
    )
