# System Architecture

## Overview

ParkPoker is a full-stack poker AI platform built as a monorepo. The system combines a Next.js web frontend, a FastAPI backend, a standalone Python game engine, and a multi-stage AI pipeline targeting Nash equilibrium play.

## Monorepo Structure

```
poker/
├── apps/web/                              # Next.js frontend
├── apps/api/                              # FastAPI backend
├── packages/poker-engine/poker_engine/    # Core game engine (Python)
├── ai/engine/                             # AI engine modules
├── ai/training/                           # Self-play training pipeline
├── ai/models/                             # Model checkpoints
├── scripts/                               # Shell scripts and utilities
├── docker/                                # Docker Compose and container configs
└── docs/                                  # Documentation
```

The monorepo separates concerns into three layers: application (apps/), shared libraries (packages/), and AI (ai/). Each layer can be developed, tested, and deployed independently.

---

## Frontend — apps/web/

**Stack**: Next.js (App Router), TypeScript, React, Tailwind CSS, Zustand

### Key Design Decisions

- **App Router**: File-system routing with server and client components. Pages include landing, guide, and play views.
- **Tailwind CSS**: Utility-first styling for rapid iteration on the poker table UI.
- **Zustand**: Lightweight client-side state management for game state, player actions, and UI state.
- **REST API Communication**: The frontend communicates with the backend exclusively through REST endpoints. Game state is fetched after each action; there is no WebSocket connection in the current architecture.

### Page Structure

| Route       | Purpose                        |
|-------------|--------------------------------|
| `/`         | Landing page                   |
| `/guide`    | Poker rules and how-to-play    |
| `/play`     | Main game interface            |

---

## Backend — apps/api/

**Stack**: FastAPI, Python, Uvicorn

### Services

- **game_manager**: Manages game lifecycle — creation, state transitions, action processing, and game completion. Orchestrates communication between the poker engine and AI player services.
- **ai_player**: Wraps the AI engine to provide move selection for computer-controlled players. Selects the appropriate AI difficulty/algorithm based on game configuration.

### API Flow

1. Client sends a game creation request.
2. `game_manager` initializes a new game via the poker engine.
3. On each player action, the client sends the action to the API.
4. `game_manager` validates and applies the action through the engine.
5. If it is the AI's turn, `ai_player` selects and applies an action.
6. The updated (information-hidden) game state is returned to the client.

---

## Game Engine — packages/poker-engine/

The poker engine is a standalone Python package with no web framework dependencies. It implements Texas Hold'em with strict WSOP rule compliance.

### Finite State Machine

The game progresses through a fixed sequence of states:

```
DEAL_HOLE
  -> PREFLOP_BET
    -> DEAL_FLOP
      -> FLOP_BET
        -> DEAL_TURN
          -> TURN_BET
            -> DEAL_RIVER
              -> RIVER_BET
                -> SHOWDOWN
                  -> PAYOUT
```

Each state transition is deterministic given the current state and the incoming action. Invalid transitions are rejected.

### Core Principles

- **Immutable State Snapshots**: Every state transition produces a new state object. Previous states are never mutated. This enables replay, debugging, and AI tree search.
- **Action Validation**: All player actions (fold, check, call, raise, all-in) are validated against the current game state before being applied. Invalid actions are rejected with descriptive errors.
- **Information Hiding**: The engine produces player-specific views of the game state. Each player only sees their own hole cards; opponent cards are hidden until showdown. This prevents information leakage in the API layer.

---

## AI Pipeline

The AI system follows a staged development approach, with each stage building on the previous one.

```
Baseline (easy/medium/hard)
  -> Vanilla CFR (Kuhn Poker verified)
    -> MCCFR (External Sampling)
      -> Deep CFR (PyTorch)
        -> Real-time Search
```

### Stage Descriptions

| Stage            | Description                                                        |
|------------------|--------------------------------------------------------------------|
| Baseline         | Rule-based AI at three difficulty levels using preflop hand tiers   |
| Vanilla CFR      | Counterfactual Regret Minimization, verified on Kuhn Poker         |
| MCCFR            | Monte Carlo CFR with external sampling (Pluribus-style)            |
| Deep CFR         | Neural network function approximation for CFR (PyTorch)            |
| Real-time Search | Depth-limited search with blueprint strategy at inference time     |

### Components

- **ai/engine/**: Core AI modules — baseline logic, CFR solver, information abstraction, hand strength estimation.
- **ai/training/**: Self-play training pipeline — game generation, strategy updates, evaluation arena, ELO tracking, model registry.
- **ai/models/**: Serialized model checkpoints and strategy files.

---

## Deployment

| Component | Platform | Notes                                    |
|-----------|----------|------------------------------------------|
| Frontend  | Vercel   | Automatic deployments from main branch   |
| Backend   | Railway  | Containerized FastAPI with Uvicorn       |

The frontend on Vercel communicates with the backend on Railway over HTTPS. Environment variables configure the API base URL per deployment environment.
