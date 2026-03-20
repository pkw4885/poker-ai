# TexasSolver GTO Poker Solver - Technical Study

**Repository**: https://github.com/bupticybee/TexasSolver
**License**: GNU AGPL v3
**Language**: C++ (with Qt GUI, OpenMP parallelism)
**Study Date**: 2026-03-20

---

## 1. Architecture Overview

TexasSolver is a heads-up (2-player) Texas Hold'em and short-deck poker GTO solver. It computes Nash equilibrium strategies using Counterfactual Regret Minimization (CFR). The codebase is organized into these key modules:

### Module Structure

```
include/
  solver/        # Core CFR solving algorithms
    Solver.h          - Abstract base class (train, dumps, get_strategy, get_evs)
    PCfrSolver.h      - Parallel CFR solver (main implementation)
    CfrSolver.h       - Single-thread CFR (thin wrapper, imports same deps)
    BestResponse.h    - Exploitability calculation via best response
  trainable/     # Strategy/regret storage per information set
    Trainable.h              - Abstract interface (getAverageStrategy, updateRegrets)
    DiscountedCfrTrainable.h - Discounted CFR regret tracker (primary)
    CfrPlusTrainable.h       - CFR+ regret tracker (legacy, not actively used)
    DiscountedCfrTrainableHF.h - Half-float memory optimization variant
  nodes/         # Game tree node types
    GameTreeNode.h   - Base node (round, pot, parent, depth)
    ActionNode.h     - Decision point (actions, children, player, trainables)
    ChanceNode.h     - Card deal node (single child shared, card list)
    ShowdownNode.h   - Showdown payoff node
    TerminalNode.h   - Fold/terminal payoff node
  ranges/        # Hand range management
    PrivateCards.h        - Two-card hand (card1, card2, weight)
    PrivateCardsManager.h - Cross-player card conflict resolution
    RiverRangeManager.h   - River hand ranking/caching
    RiverCombs.h          - Sorted river hand combos by rank
  compairer/     # Hand evaluation
    Compairer.h      - Abstract hand comparator
    Dic5Compairer.h  - Dictionary-based 5-card hand evaluator (lookup table)
  tools/         # Configuration and utilities
    Rule.h                   - Game rules (blinds, stack, raise limits)
    StreetSetting.h          - Per-street bet/raise/donk sizes + allin flag
    GameTreeBuildingSettings.h - IP/OOP settings for flop/turn/river
    CommandLineTool.h        - Console command parser
  GameTree.h     # Game tree builder and JSON serializer
  runtime/
    PokerSolver.h  - High-level orchestrator (build tree, train, dump)
```

### Data Flow

1. **Configuration** -> `Rule` + `GameTreeBuildingSettings` define the game parameters
2. **Tree Construction** -> `GameTree` builds the betting tree recursively
3. **Solving** -> `PCfrSolver` runs CFR iterations over the tree
4. **Convergence Check** -> `BestResponse` computes exploitability each interval
5. **Output** -> Strategy dumped as JSON via `Trainable::dump_strategy()`

---

## 2. Algorithm Details

### CFR Variant: Discounted CFR (Primary)

The solver uses **Discounted CFR** as its primary algorithm (`trainer = "discounted_cfr"`). CFR+ is present in the codebase but marked as unsupported in the current parallel solver.

#### Discounted CFR Parameters (hardcoded constants)

```cpp
constexpr static float alpha = 1.5f;  // Positive regret discount exponent
constexpr static float beta = 0.5f;   // Negative regret discount multiplier
constexpr static float gamma = 2;     // Strategy accumulation discount exponent
constexpr static float theta = 0.9f;  // Cumulative strategy decay factor
```

#### Regret Update Logic

From `DiscountedCfrTrainable::updateRegrets()`:

```
For each (action, hand) pair:
  1. r_plus[index] = old_regret + new_regret
  2. If r_plus > 0: r_plus *= alpha_coef   where alpha_coef = t^alpha / (1 + t^alpha)
  3. If r_plus <= 0: r_plus *= beta
  4. r_plus_sum[hand] = sum of max(0, r_plus) across actions

Then compute current_strategy from regret-matching:
  strategy[action][hand] = max(0, r_plus[index]) / r_plus_sum[hand]

Update cumulative strategy:
  strategy_coef = (t / (t+1))^gamma
  cum_r_plus[index] *= theta  (decay old cumulative)
  cum_r_plus[index] += current_strategy * strategy_coef
```

This is a variant of the "DCFR" algorithm from Brown & Sandholm (2019). Key differences from vanilla CFR:
- **Positive regrets** are weighted by `t^1.5 / (1 + t^1.5)`, approaching 1 as iterations increase
- **Negative regrets** are multiplied by 0.5 each iteration (faster forgetting)
- **Cumulative strategy** uses both power-law weighting (`gamma=2`) and exponential decay (`theta=0.9`)

#### Current Strategy (Regret Matching)

```
If r_plus_sum[hand] != 0:
    strategy[action][hand] = max(0, r_plus[action][hand]) / r_plus_sum[hand]
Else:
    strategy[action][hand] = 1.0 / num_actions  (uniform)
```

#### Average Strategy (Final Output)

The average strategy is the converged solution. Computed from cumulative regret-weighted strategies:

```
For each hand:
    total = sum of cum_r_plus across all actions
    avg_strategy[action][hand] = cum_r_plus[action][hand] / total
    If total == 0: avg_strategy = uniform
```

### Training Loop

From `PCfrSolver::train()`:

```
1. Initialize BestResponse calculator
2. Print initial exploitability (iteration 0)
3. For each iteration i in [0, iteration_number):
    a. For each player (0 and 1):
        - Run cfr(player, root, opponent_reach_probs, i, initial_board, deal=0)
    b. Every print_interval iterations (after warmup):
        - Compute and print exploitability via BestResponse
        - If exploitability <= accuracy threshold: STOP
4. Final pass: collect EVs (expected values) for display
```

### Convergence Measurement

Exploitability is computed as a percentage of pot:

```
total_exploitability = (sum of player exploitabilities) / num_players / initial_pot * 100
```

Each player's exploitability is the EV of their best response strategy minus the EV of the current strategy, summed across all hands weighted by opponent reach probabilities.

### Parallelism

- Uses **OpenMP** (`#pragma omp parallel for`) for parallelizing chance node evaluation
- Thread count configurable (defaults to `omp_get_num_procs()`)
- Splits work at a "split round" (one street deeper than root):
  - Root at PREFLOP -> split at FLOP
  - Root at FLOP -> split at TURN
  - Root at TURN -> split at RIVER
- No parallelism used when root is RIVER (unnecessary)

### Warmup Phase

During warmup iterations (configurable, default -1 = no warmup):
- Card isomorphism abstraction is used: only one representative suit per rank group is solved
- After warmup, strategies are copied from the representative to all isomorphic deals
- Random card sampling during warmup reduces computation per iteration

---

## 3. Hand Abstraction Method

### No Abstraction (Exact Solving)

TexasSolver does **not** use hand abstraction in the traditional sense (bucketing). It solves **exactly** for every possible hand combo. This is feasible because:

1. It targets **postflop** solving (flop/turn/river), not preflop
2. For postflop, the number of remaining cards is manageable
3. It uses suit isomorphisms to reduce redundant computation

### Suit Isomorphism

The solver identifies **color isomorphisms** -- situations where two suits are interchangeable given the board.

From `findGameSpecificIsomorphisms()`:
- For each deal (chance card), computes a hash per suit based on board + dealt cards
- If two suits have identical hashes (same rank pattern), one maps to the other via `color_iso_offset`
- During CFR traversal, isomorphic deals are skipped and results copied with suit exchange
- This can cut chance node branching by up to 4x on rainbow boards

### Hand Evaluation

Uses a **dictionary-based 5-card evaluator** (`Dic5Compairer`):
- Pre-computed lookup table with ~2.6M entries (holdem) or ~377K (short deck)
- Maps 5-card combinations to integer ranks
- Separate hash maps for flush and non-flush hands
- Binary file caching (`card5_dic_zipped.bin`) for fast loading

### River Range Management

`RiverRangeManager` pre-sorts hands by rank for each board:
- Creates `RiverCombs` sorted by hand strength
- Enables O(n) showdown equity calculation using two-pointer sweep
- Cached per unique board (keyed by board bitmap)

---

## 4. Betting Tree Construction

### Tree Node Types

| Node Type | Description |
|-----------|-------------|
| `ActionNode` | Player decision point. Contains: actions list, children nodes, player ID, trainable strategies |
| `ChanceNode` | Card deal. Single child shared across all possible cards. Cards from deck. |
| `ShowdownNode` | Both players show down. Contains: payoffs for each winner + tie |
| `TerminalNode` | One player folded. Contains: payoff vector |

### Building Algorithm

`GameTree::buildAction()` constructs the tree recursively based on the last action:

```
After "roundbegin" or "begin":  [check, bet]
After "bet":                     [call, raise, fold]
After "raise":                   [call, raise, fold]
After "check":                   [check, raise, bet]
After "call":                    [check, raise]  (new street starts via ChanceNode)
```

### Bet Sizing

Configured per street (flop/turn/river), per position (IP/OOP), per bet type (bet/raise/donk):

```
StreetSetting {
    vector<float> bet_sizes;    // e.g., [50, 100] = 50% pot, 100% pot
    vector<float> raise_sizes;  // e.g., [50] = 50% pot raise
    vector<float> donk_sizes;   // out-of-position lead bets
    bool allin;                 // include all-in as an option
}
```

Bet calculation from `get_possible_bets()`:
1. Convert percentages to chip amounts: `amount = ratio * pot`
2. Round to nearest blind increment
3. For raises: add the gap (opponent commit - player commit)
4. If amount exceeds `allin_threshold * stack`: convert to all-in
5. Filter: minimum raise must be >= 2x the previous bet gap
6. Deduplicate amounts

### Special Handling

- **Preflop**: SB treated as a forced bet; first raise relative to BB
- **Donk bets**: Tracked via `ChanceNode::isDonk()` flag when OOP acts first after a call
- **Raise limit**: Configurable cap on number of raises per street (default: 3)
- **All-in threshold**: If a bet would put player above this fraction of stack, auto-converts to all-in

### Tree from JSON

The tree can also be loaded from a JSON file with a defined structure:
```json
{
  "root": {
    "meta": { "node_type": "Action", "round": "flop", "player": 1, "pot": 10 },
    "children_actions": ["check", "bet_50"],
    "children": [...]
  }
}
```

---

## 5. Strategy Output Format

### JSON Structure

The solver dumps strategy as a nested JSON tree mirroring the game tree:

```json
{
  "actions": ["CHECK", "BET_50.0", "BET_100.0"],
  "player": 1,
  "node_type": "action_node",
  "strategy": {
    "actions": ["CHECK", "BET_50.0", "BET_100.0"],
    "strategy": {
      "AhKh": [0.45, 0.30, 0.25],
      "AhKs": [0.50, 0.28, 0.22],
      ...
    }
  },
  "childrens": {
    "CHECK": { ... },
    "BET_50.0": { ... },
    "BET_100.0": { ... }
  }
}
```

For each `ActionNode`:
- `actions`: list of available actions as strings
- `player`: 0 (IP) or 1 (OOP)
- `strategy.strategy`: maps each hand (e.g., "AhKs") to a probability vector matching the action list
- `childrens`: recursively contains child nodes keyed by action string

For `ChanceNode`:
- `node_type`: "chance_node"
- `deal_number`: number of possible cards
- `dealcards`: maps each card (e.g., "Td") to a subtree

### Programmatic Access

`PCfrSolver::get_strategy(ActionNode, chance_cards)` returns:
- `vector<vector<vector<float>>>` indexed as `[card1][card2][action_id]`
- 52x52 matrix where each cell is the strategy vector for that hand combo

`PCfrSolver::get_evs(ActionNode, chance_cards)` returns same structure but with EV values per action.

### EV Calculation

EVs are normalized by opponent reach probability at each action node:
```
ev[hand][action] = raw_utility[hand][action] / opponent_reach_sum_excluding_blocker_cards
```

---

## 6. Performance Characteristics

### Benchmark Results (vs PioSolver 1.0, SPR=10, flop game)

| Metric | PioSolver | TexasSolver |
|--------|-----------|-------------|
| Threads | 6 | 6 |
| Memory | 492 MB | 1600 MB |
| Accuracy | 0.29% exploitability | 0.275% exploitability |
| Time | 242 seconds | 172 seconds |

TexasSolver is ~30% faster but uses ~3x more memory.

### Memory Optimization Options

- **Half-float storage** (`DiscountedCfrTrainableHF`): Uses 16-bit floats for regrets and cumulative strategy, reducing memory by ~50%
- **Suit isomorphism**: Reduces number of trainable instances at chance nodes
- **Tree pruning**: Referenced in comments but not yet fully implemented

### Memory Estimation

`GameTree::estimate_tree_memory()` calculates approximate memory:
```
Per ActionNode: num_deals * player_range_size * (num_actions + 1) * 3 floats
Per ChanceNode: multiplies child estimate by deck_size
```

---

## 7. Key Implementation Details

### Card Representation

- Cards stored as integers 0-51
- `card_int % 4` = suit (c=0, d=1, h=2, s=3)
- `card_int / 4` = rank
- Board represented as `uint64_t` bitmask for fast intersection checks
- `Card::boardsHasIntercept(a, b)` checks if two card sets overlap (bitwise AND)

### Private Cards Manager

`PrivateCardsManager` handles:
- Removing hands that conflict with the board
- Cross-referencing between player ranges (finding matching hands across players)
- `indPlayer2Player(from, to, hand_id)` maps a hand index from one player's range to another's

### Trainable Storage

Each `ActionNode` stores a vector of `Trainable` pointers, one per "deal" index:
- Deal 0: root (no chance cards dealt yet)
- Deal 1 to N: one dealt card
- Deal N+1 to N*N: two dealt cards
- This allows per-board-runout strategies without duplicating the tree structure

### Range Input Format

Ranges use standard poker notation with optional weights:
```
AA,KK,QQ:0.5,AKs,AKo:0.75,T9s:0.75,87s:0.5
```
- `AA` = all combos of pocket aces at weight 1.0
- `QQ:0.5` = pocket queens at 50% frequency
- `AKs` = suited AK, `AKo` = offsuit AK

---

## 8. Adaptation Strategy for Our Poker Guide Feature

### What We Can Directly Use

1. **Strategy representation**: The JSON output format maps hands to action probability vectors. This is ideal for our guide -- we can display "With AhKh on this board, GTO says: Check 45%, Bet half-pot 30%, Bet pot 25%."

2. **Range notation**: The standard range string format with weights is already a de facto standard in poker tools. We should adopt it.

3. **Bet sizing model**: The `StreetSetting` approach of specifying bet sizes as pot percentages per street/position is clean and configurable.

4. **Game tree structure**: The 4-node-type tree (Action, Chance, Showdown, Terminal) is a good model for our own game tree representation.

### What We Should Simplify

1. **Pre-computed solutions over real-time solving**: Running CFR in real-time is not practical for a mobile/web app. Instead:
   - Pre-compute solutions for common spots (standard flop textures, common stack depths)
   - Store compressed strategy tables indexed by board texture + position + action sequence
   - Use interpolation for unusual spots

2. **Hand evaluation**: We don't need to implement a 5-card evaluator from scratch. We can use an existing library or lookup table (the `card5_dic_sorted.txt` approach is effective).

3. **Simplified bet trees**: TexasSolver allows arbitrary bet sizes. For a guide feature, we should limit to 2-3 common sizes per street (e.g., 33%, 67%, 100% pot + all-in) to keep the strategy database manageable.

### Implementation Recommendations

#### Phase 1: Pre-computed Strategy Database

```
Strategy DB Schema:
  - board_texture (flop category: dry, wet, paired, monotone, etc.)
  - position (IP/OOP)
  - action_sequence (e.g., "check-bet75-?")
  - hand -> action_probabilities mapping
  - ev_per_action mapping
```

#### Phase 2: Simplified Solver (Optional)

If we want real-time solving for custom spots:
- Implement Discounted CFR in our language of choice
- Use the same alpha=1.5, beta=0.5, gamma=2, theta=0.9 parameters
- Limit to river-only solving first (smallest tree, fastest convergence)
- Target 1% exploitability (less than 100 iterations needed for river)

#### Phase 3: Strategy Display

Model the display after TexasSolver's GUI approach:
- Show a hand matrix (13x13 grid of hand categories)
- Color-code by recommended action (fold=red, call=green, raise=blue)
- Show mixed strategy frequencies for each hand
- Display EV for each action option

### Key Architectural Decisions

| Decision | TexasSolver Approach | Our Recommended Approach |
|----------|---------------------|-------------------------|
| Solving | Real-time CFR | Pre-computed + optional light solver |
| Precision | Exact (no abstraction) | Exact for common spots, simplified for rare ones |
| Bet sizes | Fully configurable | Fixed common sizes (33/67/100/allin) |
| Output | JSON dump | Structured DB with fast lookup by spot |
| Parallelism | OpenMP threads | Not needed if pre-computed; Web Workers if client-side |

---

## 9. Key Takeaways

1. **Discounted CFR is the state-of-the-art** for poker solving. The specific parameters (alpha=1.5, beta=0.5, gamma=2) from Brown & Sandholm (2019) provide faster convergence than vanilla CFR or CFR+.

2. **Suit isomorphism** is a critical optimization. On a rainbow board like Qs Jh 2d, all 4 suits behave identically for non-board suits, reducing work by ~4x at each chance node.

3. **No hand abstraction needed for postflop**. Unlike preflop solvers that must bucket 1326 hand combos, postflop solving with known board cards is tractable without abstraction.

4. **Exploitability as convergence metric** is essential. The BestResponse computation tells you exactly how far from Nash equilibrium you are, measured as percentage of pot.

5. **Memory is the bottleneck**, not compute time. Each ActionNode needs storage for `num_actions * range_size` floats, multiplied by the number of possible board runouts. Half-float optimization roughly halves this.

6. **Strategy output is per-hand, per-action probability vectors**. The average strategy (not current strategy) is the converged solution. This is what we display to users.

7. **Tree structure mirrors actual poker decisions**. The Action -> Chance -> Showdown/Terminal pattern naturally models poker gameplay and makes strategy navigation intuitive.

8. **The AGPL license prohibits direct code integration** in our commercial product. We must implement our own solver or use pre-computed results. The algorithmic ideas (Discounted CFR, suit isomorphism, regret matching) are not patented and can be freely implemented.

---

## 10. Source File Reference

Key files for deeper study:

| File | Purpose |
|------|---------|
| `src/solver/PCfrSolver.cpp` | Core CFR algorithm, train loop, utility functions |
| `src/trainable/DiscountedCfrTrainable.cpp` | Regret update and strategy computation |
| `src/GameTree.cpp` | Betting tree construction and bet sizing logic |
| `src/solver/BestResponse.cpp` | Exploitability calculation |
| `src/tools/CommandLineTool.cpp` | Console interface and configuration parsing |
| `src/runtime/PokerSolver.cpp` | High-level orchestrator |
| `include/nodes/ActionNode.h` | Decision node with trainable storage |
| `include/ranges/RiverRangeManager.h` | Hand ranking and showdown utilities |
| `benchmark/benchmark_texassolver.txt` | Example solver configuration |
