# AI Engine

This document covers the design and implementation of the ParkPoker AI system, from rule-based baselines to CFR-based solvers.

---

## Baseline AI

The baseline AI provides three difficulty levels for immediate playability without requiring trained models.

### Difficulty Levels

| Level  | Behavior                                                              |
|--------|-----------------------------------------------------------------------|
| Easy   | Plays loosely. Calls most hands, rarely raises, folds only the worst holdings. |
| Medium | Uses preflop hand tiers to make fold/call/raise decisions. Applies basic pot odds on later streets. |
| Hard   | Tighter preflop selection, positional awareness, aggression with strong hands, bluffs occasionally based on board texture. |

### Preflop Hand Tier System

All starting hands are classified into five tiers:

| Tier | Hands                                      | Action Tendency        |
|------|---------------------------------------------|------------------------|
| 1    | AA, KK, QQ, AKs                            | Always raise / re-raise |
| 2    | JJ, TT, AQs, AKo, AQo                     | Raise, call re-raises   |
| 3    | 99-77, AJs-ATs, KQs, KQo                   | Raise or call            |
| 4    | 66-22, suited connectors, suited aces       | Call, fold to heavy action |
| 5    | Everything else                              | Fold (easy: sometimes call) |

Post-flop decisions use hand strength estimation (see below) combined with pot odds.

---

## Hand Strength Estimation

### Monte Carlo Simulation

Hand strength is estimated by running Monte Carlo rollouts:

1. Given the player's hole cards and the known community cards, sample random completions of the remaining board.
2. For each sample, enumerate possible opponent holdings and determine win/loss/tie.
3. The hand strength is the ratio of wins (plus half-ties) to total matchups.

This provides an approximate equity value between 0.0 and 1.0. The number of samples is configurable to trade accuracy for speed. The AI uses this value to make post-flop decisions at all difficulty levels.

---

## Counterfactual Regret Minimization (CFR)

### Vanilla CFR

The vanilla CFR implementation follows the standard algorithm:

1. Traverse the full game tree.
2. At each information set, compute counterfactual regret for each action.
3. Accumulate regrets over iterations.
4. Update the strategy using regret matching: actions with positive regret receive probability proportional to their regret; actions with zero or negative regret receive zero probability.
5. The average strategy over all iterations converges to a Nash equilibrium.

### Kuhn Poker Verification

The CFR solver has been verified on Kuhn Poker (a simplified 3-card poker game):

- **Expected value**: Converges to the known Nash equilibrium value of approximately -1/18 for player 1.
- **Strategy profile**: The computed strategy matches the known equilibrium strategies for all information sets.
- This verification confirms correctness of the core CFR algorithm before scaling to larger games.

---

## Monte Carlo CFR (MCCFR)

### External Sampling Variant

The MCCFR implementation uses external sampling, following the approach used in Pluribus:

- Instead of traversing the full game tree, only one trajectory is sampled per iteration.
- Chance nodes and opponent actions are sampled (external sampling), while the traversing player's actions are all explored.
- This reduces per-iteration cost from exponential to linear in the game tree depth.
- Convergence guarantees are preserved in expectation.

### Advantages Over Vanilla CFR

- Handles large game trees that are intractable for full traversal.
- Per-iteration compute scales linearly with tree depth.
- Well-suited for Texas Hold'em with its large state space.

---

## Information Abstraction

To make CFR tractable on full Texas Hold'em, the game is abstracted along two dimensions.

### Hand Bucketing

- Hands with similar equity are grouped into buckets.
- Bucketing is performed per street (preflop, flop, turn, river).
- This reduces the number of information sets by orders of magnitude.

### Suit Isomorphism

- Strategically equivalent hands that differ only in suit assignment are collapsed into a single canonical form.
- Example: Ah Kh and As Ks are treated identically preflop (both are suited AK).
- This further reduces the information set count without any loss of strategic accuracy.

### Action Abstraction

- The continuous bet-sizing space is discretized into a fixed set of actions.
- Typical abstractions: fold, check/call, pot-fraction raises (0.5x, 1x, 2x pot), all-in.
- The abstraction set is configurable per street and can be refined as training progresses.

---

## Self-Play Training Pipeline

The training pipeline automates strategy improvement through iterative self-play.

### Pipeline Stages

```
self_play -> arena -> elo_tracking -> model_registry
```

| Stage          | Description                                                      |
|----------------|------------------------------------------------------------------|
| self_play      | Generate games between current AI agents. Accumulate regrets and update strategy profiles. |
| arena          | Evaluate new strategy checkpoints against previous versions in head-to-head matches. |
| elo_tracking   | Maintain an ELO rating for each checkpoint to track improvement over time. |
| model_registry | Store and version strategy checkpoints. Tag the best-performing model as the current default. |

### Training Loop

1. Run N iterations of MCCFR self-play, producing a new strategy checkpoint.
2. Enter the arena: play the new checkpoint against the current best across M hands.
3. Update ELO ratings based on arena results.
4. If the new checkpoint surpasses the current best, promote it in the model registry.
5. Repeat.

Checkpoints are saved to `ai/models/` with metadata including iteration count, ELO rating, and training parameters.
