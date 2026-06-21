import type { Card } from "../domain/cards/card";
import { createDeck, shuffleDeck } from "../domain/cards/deck";
import { Game } from "../domain/game/game";
import { evaluateHand } from "../domain/poker/handEvaluator";
import type { Session } from "../domain/session/session";
import {
  serializeAction,
  serializeBoardFlop,
  serializeBoardRiver,
  serializeBoardTurn,
  serializeChips,
  serializeEliminated,
  serializeGameInfo,
  serializeGameOver,
  serializePots,
  serializeResult,
  serializeRoundStart,
  serializeTurn,
} from "../protocol/serializer/gameSerializer";
import { PlayerState, RoundState, SessionState } from "../utils/constants";

/**
 * GameService orchestrates the poker flow for a session.
 * It manages the deck, bets, pots, community cards, turn order, and hand evaluation.
 * The implementation follows the textual protocol defined in PROTOCOLO.md.
 */
class GameService {
  private readonly games: Map<string, Game> = new Map(); // keyed by session ID

  // ---------- Game lifecycle ----------
  initGame(session: Session): Game {
    const deck = shuffleDeck(createDeck());
    const game = new Game(session.id, deck);
    this.games.set(session.id, game);
    return game;
  }

  getGame(sessionId: string): Game | undefined {
    return this.games.get(sessionId);
  }

  // ---------- Information ----------
  broadcastGameInfo(session: Session): void {
    const players = Array.from(session.players.values()).map((p) => ({
      id: p.id,
      chips: p.chips,
    }));
    const msg = serializeGameInfo(players);
    session.players.forEach((p) => p.ws?.send(msg));
  }

  // ---------- Round handling ----------
  startRound(session: Session): void {
    const game = this.getGame(session.id) ?? this.initGame(session);
    // Deal two private cards to each player (hole cards)
    for (const player of session.players.values()) {
      const card1 = game.deck.shift();
      const card2 = game.deck.shift();
      if (card1 && card2) {
        player.holeCards = [card1, card2];
        // Send private hole cards to the player only
        const holeMsg = `game hole ${card1.value}${card1.suit} ${card2.value}${card2.suit}`;
        player.ws?.send(holeMsg);
      }
    }

    // Determine dealer, small blind, big blind (rotate simple order)
    const playerIds = Array.from(session.players.keys());
    const dealerId = playerIds[0];
    const smallBlindId = playerIds[1 % playerIds.length];
    const bigBlindId = playerIds[2 % playerIds.length];
    const seatAssignments = playerIds.map((pid, idx) => ({
      position: idx,
      playerId: pid,
    }));

    const roundStartMsg = serializeRoundStart(
      dealerId,
      smallBlindId,
      bigBlindId,
      session.smallBlind,
      session.bigBlind,
      playerIds.length,
      seatAssignments
    );
    session.players.forEach((p) => p.ws?.send(roundStartMsg));

    // Initialize betting state
    game.bets = new Map();
    game.currentBet = 0;
    game.actingPlayerId = smallBlindId; // first action after blinds
    // Post blinds automatically
    this.postBlind(session, smallBlindId, session.smallBlind);
    this.postBlind(session, bigBlindId, session.bigBlind);
    // Notify turn for the player after big blind
    const nextPlayerId = this.nextActingPlayer(session, game.actingPlayerId);
    game.actingPlayerId = nextPlayerId;
    const turnMsg = serializeTurn(
      nextPlayerId,
      session.bigBlind,
      session.bigBlind * 2,
      session.bigBlind * 4,
      15_000
    );
    session.players.forEach((p) => p.ws?.send(turnMsg));
  }

  private postBlind(session: Session, playerId: string, amount: number): void {
    const player = session.players.get(playerId);
    if (!player) {
      return;
    }
    player.chips -= amount;
    player.state = PlayerState.Active;
    const game = this.getGame(session.id);
    if (game) {
      game.bets.set(playerId, amount);
      game.currentBet = Math.max(game.currentBet, amount);
    }
    const actionMsg = serializeAction(
      playerId,
      "blind",
      amount,
      amount,
      player.chips
    );
    session.players.forEach((p) => p.ws?.send(actionMsg));
  }

  // ---------- Action handling ----------
  handleAction(
    session: Session,
    playerId: string,
    action: string,
    amount = 0
  ): void {
    const player = session.players.get(playerId);
    const game = this.getGame(session.id);
    if (!(player && game)) {
      return;
    }

    switch (action) {
      case "fold":
        player.state = PlayerState.Folded;
        break;
      case "check":
        player.state = PlayerState.Active;
        break;
      case "call": {
        const toCall = game.currentBet - (game.bets.get(playerId) ?? 0);
        const callAmt = Math.min(toCall, player.chips);
        player.chips -= callAmt;
        player.state = PlayerState.Active;
        game.bets.set(playerId, (game.bets.get(playerId) ?? 0) + callAmt);
        break;
      }
      case "bet": {
        const betAmt = Math.min(amount, player.chips);
        player.chips -= betAmt;
        player.state = PlayerState.Active;
        game.bets.set(playerId, betAmt);
        game.currentBet = betAmt;
        break;
      }
      case "raise": {
        const toCall = game.currentBet - (game.bets.get(playerId) ?? 0);
        const raiseTotal = toCall + amount; // amount is raise-to total
        const raiseAmt = Math.min(raiseTotal, player.chips);
        player.chips -= raiseAmt;
        player.state = PlayerState.Active;
        const newBet = (game.bets.get(playerId) ?? 0) + raiseAmt;
        game.bets.set(playerId, newBet);
        game.currentBet = newBet;
        break;
      }
      case "all_in": {
        const allInAmt = player.chips;
        player.chips = 0;
        player.state = PlayerState.AllIn;
        game.bets.set(playerId, (game.bets.get(playerId) ?? 0) + allInAmt);
        // currentBet may stay the same if allInAmt < currentBet, side pot will be created later
        break;
      }
      default:
        // unknown action – ignore
        return;
    }

    // Broadcast the performed action
    const _totalBet = game.bets.get(playerId) ?? 0;
    const potTotal = Array.from(game.bets.values()).reduce((a, b) => a + b, 0);
    const actionMsg = serializeAction(
      playerId,
      action,
      amount,
      potTotal,
      player.chips
    );
    session.players.forEach((p) => p.ws?.send(actionMsg));

    // Determine next acting player
    const nextId = this.nextActingPlayer(session, game.actingPlayerId);
    game.actingPlayerId = nextId;
    // If betting round is finished, compute pots and advance round
    if (this.isBettingRoundComplete(session, game)) {
      this.computePots(session);
      // Reset bets for next round
      game.bets.clear();
      game.currentBet = 0;
      this.advanceRound(session);
    } else {
      const turnMsg = serializeTurn(
        nextId,
        game.currentBet,
        game.currentBet * 2,
        game.currentBet * 4,
        15_000
      );
      session.players.forEach((p) => p.ws?.send(turnMsg));
    }
  }

  private isBettingRoundComplete(session: Session, game: Game): boolean {
    // Betting round ends when every player who is still active has either matched the current bet or is all‑in/folded
    for (const player of session.players.values()) {
      if (
        player.state === PlayerState.Folded ||
        player.state === PlayerState.AllIn
      ) {
        continue;
      }
      const bet = game.bets.get(player.id) ?? 0;
      if (bet < game.currentBet) {
        return false;
      }
    }
    return true;
  }

  // ---------- Pot calculation ----------
  computePots(session: Session): void {
    const game = this.getGame(session.id);
    if (!game) {
      return;
    }
    const betEntries = Array.from(game.bets.entries());
    if (betEntries.length === 0) {
      return;
    }
    betEntries.sort((a, b) => a[1] - b[1]);
    const pots: { type: string; amount: number; eligible: string[] }[] = [];
    let prev = 0;
    const remaining = new Set<string>(betEntries.map((e) => e[0]));
    for (const [pid, bet] of betEntries) {
      const contribution = bet - prev;
      if (contribution > 0) {
        const eligible = Array.from(remaining);
        const potAmt = contribution * eligible.length;
        const type = prev === 0 ? "MAIN" : "SIDE";
        pots.push({ type, amount: potAmt, eligible });
        prev = bet;
      }
      remaining.delete(pid);
    }
    const serialized = serializePots(pots);
    session.players.forEach((p) => p.ws?.send(serialized));
  }

  // ---------- Round progression ----------
  private advanceRound(session: Session): void {
    const game = this.getGame(session.id);
    if (!game) {
      return;
    }
    const next = this.nextRoundState(game.round);
    game.round = next;
    switch (next) {
      case RoundState.Flop:
        this.dealCommunity(game, 3);
        this.broadcastBoardFlop(session, game);
        break;
      case RoundState.Turn:
        this.dealCommunity(game, 1);
        this.broadcastBoardTurn(session, game);
        break;
      case RoundState.River:
        this.dealCommunity(game, 1);
        this.broadcastBoardRiver(session, game);
        break;
      case RoundState.Showdown:
        this.handleShowdown(session, game);
        break;
      default:
        break;
    }
    // If not showdown, start next betting turn
    if (next !== RoundState.Showdown) {
      const firstActive = this.firstActivePlayer(session);
      game.actingPlayerId = firstActive;
      const turnMsg = serializeTurn(firstActive, 0, 0, 0, 15_000);
      session.players.forEach((p) => p.ws?.send(turnMsg));
    }
  }

  private nextRoundState(current: RoundState): RoundState {
    switch (current) {
      case RoundState.PreFlop:
        return RoundState.Flop;
      case RoundState.Flop:
        return RoundState.Turn;
      case RoundState.Turn:
        return RoundState.River;
      case RoundState.River:
        return RoundState.Showdown;
      default:
        return current;
    }
  }

  private dealCommunity(game: Game, count: number): void {
    for (let i = 0; i < count; i++) {
      const card = game.deck.shift();
      if (card) {
        game.communityCards.push(card);
      }
    }
  }

  private cardToString(card: Card): string {
    return `${card.value}${card.suit}`;
  }

  private broadcastBoardFlop(session: Session, game: Game): void {
    const flop = game.communityCards.slice(-3);
    if (flop.length < 3) {
      return;
    }
    const msg = serializeBoardFlop(
      this.cardToString(flop[0]),
      this.cardToString(flop[1]),
      this.cardToString(flop[2])
    );
    session.players.forEach((p) => p.ws?.send(msg));
  }

  private broadcastBoardTurn(session: Session, game: Game): void {
    const card = game.communityCards.at(-1);
    if (!card) {
      return;
    }
    const msg = serializeBoardTurn(this.cardToString(card));
    session.players.forEach((p) => p.ws?.send(msg));
  }

  private broadcastBoardRiver(session: Session, game: Game): void {
    const card = game.communityCards.at(-1);
    if (!card) {
      return;
    }
    const msg = serializeBoardRiver(this.cardToString(card));
    session.players.forEach((p) => p.ws?.send(msg));
  }

  private firstActivePlayer(session: Session): string {
    for (const p of session.players.values()) {
      if (p.state === PlayerState.Active) {
        return p.id;
      }
    }
    // fallback to any player
    return session.players.keys().next().value ?? "";
  }

  private nextActingPlayer(session: Session, currentId: string): string {
    const ids = Array.from(session.players.keys());
    const startIdx = ids.indexOf(currentId);
    for (let i = 1; i <= ids.length; i++) {
      const candidate = ids[(startIdx + i) % ids.length];
      const player = session.players.get(candidate);
      if (!player) {
        continue;
      }
      if (player.state === PlayerState.Active) {
        return candidate;
      }
    }
    return ids[0];
  }

  // ---------- Showdown handling ----------
  private handleShowdown(session: Session, game: Game): void {
    // Send each player's hole cards privately (already sent earlier, but protocol expects them during showdown as well)
    session.players.forEach((p) => {
      if (p.holeCards.length === 2) {
        const holeMsg = `game hole ${this.cardToString(p.holeCards[0])} ${this.cardToString(p.holeCards[1])}`;
        p.ws?.send(holeMsg);
      }
    });

    // Evaluate hands and determine winner(s)
    const handRanks: { playerId: string; rank: string; handValue: number }[] =
      [];
    for (const p of session.players.values()) {
      const rank = evaluateHand(p.holeCards, game.communityCards);
      const handValue = this.rankValue(rank);
      handRanks.push({ playerId: p.id, rank, handValue });
    }
    // Find max hand value
    const maxValue = Math.max(...handRanks.map((h) => h.handValue));
    const winners = handRanks.filter((h) => h.handValue === maxValue);

    // Simple pot distribution: give whole pot to each winner equally (no side‑pot logic here – already broadcast earlier)
    const totalPot = game.pots.reduce((sum, pot) => sum + pot.amount, 0);
    const winAmount = Math.floor(totalPot / winners.length);
    const resultEntries = winners.map((w) => ({
      playerId: w.playerId,
      winAmount,
      handRank: w.rank,
    }));
    const resultMsg = serializeResult(resultEntries);
    session.players.forEach((p) => p.ws?.send(resultMsg));

    // Update chips according to win amount
    for (const w of winners) {
      const player = session.players.get(w.playerId);
      if (player) {
        player.chips += winAmount;
      }
    }
    const chipsMsg = serializeChips(
      Array.from(session.players.values()).map((p) => ({
        playerId: p.id,
        chips: p.chips,
      }))
    );
    session.players.forEach((p) => p.ws?.send(chipsMsg));

    // Eliminate players with 0 chips
    let position = 1;
    for (const p of session.players.values()) {
      if (p.chips <= 0) {
        const elimMsg = serializeEliminated(p.id, position);
        session.players.forEach((s) => s.ws?.send(elimMsg));
        p.state = PlayerState.Eliminated;
        position++;
      }
    }

    // If only one player remains with chips, end the match
    const alive = Array.from(session.players.values()).filter(
      (p) => p.chips > 0
    );
    if (alive.length === 1) {
      const overMsg = serializeGameOver(alive[0].id);
      session.players.forEach((p) => p.ws?.send(overMsg));
      session.state = SessionState.Closed;
    }
  }

  private rankValue(rank: string): number {
    // Simple ordering matching hand evaluator return values
    const order = [
      "NONE",
      "HIGH_CARD",
      "PAIR",
      "TWO_PAIR",
      "THREE_OF_A_KIND",
      "STRAIGHT",
      "FLUSH",
      "FULL_HOUSE",
      "FOUR_OF_A_KIND",
      "STRAIGHT_FLUSH",
      "ROYAL_FLUSH",
    ];
    return order.indexOf(rank);
  }
}

export const gameService = new GameService();
