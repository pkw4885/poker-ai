# WSOP Rules Implementation

This document describes the World Series of Poker (WSOP) rules implemented in the ParkPoker game engine.

---

## Betting Rules

### Minimum Raise

- The minimum raise amount equals the size of the previous raise in the current betting round.
- If no raise has occurred in the round, the minimum raise equals the big blind.
- Example: If the big blind is 100 and a player raises to 300 (a raise of 200), the next minimum raise is 200 more, requiring a total bet of at least 500.

### Betting Limits

The engine implements No-Limit Texas Hold'em:

- **Minimum bet**: Equal to the big blind.
- **Minimum raise**: Equal to the previous raise increment (or the big blind if no raise has occurred).
- **Maximum bet**: A player's entire stack (all-in).
- There is no cap on the number of raises per betting round.

---

## Pot and Side Pot Calculation

### Side Pot Algorithm

When one or more players are all-in with different stack sizes, the engine calculates side pots as follows:

1. Sort all-in players by their total contribution (ascending).
2. For each all-in threshold, create a pot that includes contributions from all eligible players up to that threshold.
3. The main pot is the first (smallest) pot; subsequent pots are side pots.
4. Each pot tracks which players are eligible to win it.
5. At showdown, each pot is awarded independently to the best eligible hand.

### Example

Three players: A bets 100 (all-in), B bets 300 (all-in), C calls 300.

| Pot      | Size               | Eligible Players |
|----------|--------------------|------------------|
| Main pot | 100 x 3 = 300     | A, B, C          |
| Side pot | (300-100) x 2 = 400 | B, C           |

---

## Blind Structure

### Cash Game Blinds

- Fixed small blind (SB) and big blind (BB) throughout the session.
- BB = 2 x SB (standard ratio).
- The dealer button rotates clockwise after each hand.

### Tournament Blinds

- Blinds increase at defined intervals.
- The blind schedule is configurable per tournament.
- Ante support is available for later tournament stages.

---

## All-In Rules

- A player may go all-in at any time by betting their entire remaining stack.
- If an all-in bet is less than the minimum raise, it does not reopen betting for players who have already acted. Other players may only call (not re-raise) unless the all-in constitutes a full raise.
- An all-in player remains in the hand through showdown but takes no further actions.
- Side pots are created as described above when stack sizes differ.

---

## Showdown Rules

### Showdown Order

- If betting concludes with two or more active players, a showdown occurs.
- The last aggressor (the player who made the final bet or raise) shows first.
- If there was no betting in the final round (all players checked), the first active player to the left of the dealer shows first.
- The best five-card hand from each player's two hole cards and the five community cards wins.

### Hand Ranking

Standard poker hand rankings apply (highest to lowest):

1. Royal Flush
2. Straight Flush
3. Four of a Kind
4. Full House
5. Flush
6. Straight
7. Three of a Kind
8. Two Pair
9. One Pair
10. High Card

### Split Pots

- If two or more players hold hands of equal rank, the pot is split evenly.
- Odd chips are awarded to the player closest to the left of the dealer.

---

## Heads-Up Special Rules

In heads-up play (two players), the standard button/blind assignment is modified:

- The **dealer** posts the **small blind**.
- The non-dealer posts the **big blind**.
- Preflop, the dealer (SB) acts first.
- On all subsequent streets (flop, turn, river), the dealer acts last (standard positional advantage).

This rule prevents the same player from having positional advantage on every street.
