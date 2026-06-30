import type { Card } from "@/domain/cards/card";
import { createDeck, shuffleDeck } from "@/domain/cards/deck";
import { Game, type Pot } from "@/domain/game/game";
import { evaluateHand } from "@/domain/poker/hand-evaluator";
import type { Session } from "@/domain/session/session";
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
} from "@/protocol/serializer/game-serializer";
import { PlayerState, RoundState, SessionState } from "@/utils/constants";

class GameService {
  private readonly games: Map<string, Game> = new Map();

  initGame(session: Session): Game {
    const deck = shuffleDeck(createDeck());
    const game = new Game(session.id, deck);
    this.games.set(session.id, game);
    return game;
  }

  getGame(sessionId: string): Game | undefined {
    return this.games.get(sessionId);
  }

  broadcastGameInfo(session: Session): void {
    const players = Array.from(session.players.values()).map((p) => ({
      id: p.id,
      chips: p.chips,
    }));
    const msg = serializeGameInfo(players);
    for (const p of session.players.values()) {
      p.ws?.send(msg);
    }
  }

  startRound(session: Session): void {
    const game = this.getGame(session.id) ?? this.initGame(session);
    // Reset game state for a new round
    game.communityCards = [];
    game.pots = [];
    game.bets = new Map();
    game.currentBet = 0;
    game.round = RoundState.PreFlop;
    game.dealerOffset++;

    // Activate eligible players for the new round
    for (const player of session.players.values()) {
      if (player.state === PlayerState.Connected) {
        player.state = PlayerState.Active;
      }
    }

    // Deal two private cards to each eligible player
    for (const player of session.players.values()) {
      if (
        player.state === PlayerState.Eliminated ||
        player.state === PlayerState.Waiting
      ) {
        continue;
      }
      const card1 = game.deck.shift();
      const card2 = game.deck.shift();
      if (card1 && card2) {
        player.holeCards = [card1, card2];
        const holeMsg = `game hole ${card1.value}${card1.suit} ${card2.value}${card2.suit}`;
        player.ws?.send(holeMsg);
      }
    }

    // Determine dealer, SB, BB with rotation
    const playerIds = Array.from(session.players.keys());
    const offset = game.dealerOffset % playerIds.length;
    const dealerId = playerIds[offset];
    const smallBlindId = playerIds[(offset + 1) % playerIds.length];
    const bigBlindId = playerIds[(offset + 2) % playerIds.length];
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
    for (const p of session.players.values()) {
      p.ws?.send(roundStartMsg);
    }

    // Post blinds automatically
    this.postBlind(session, smallBlindId, session.smallBlind);
    this.postBlind(session, bigBlindId, session.bigBlind);

    // In pre-flop, first action is UTG (player after big blind)
    game.actingPlayerId = bigBlindId;
    const firstToAct = this.nextActingPlayer(session, bigBlindId);
    game.actingPlayerId = firstToAct;

    const turnMsg = serializeTurn(
      firstToAct,
      session.bigBlind,
      session.bigBlind * 2,
      session.bigBlind * 4,
      15_000
    );
    for (const p of session.players.values()) {
      p.ws?.send(turnMsg);
    }
  }

  private postBlind(session: Session, playerId: string, amount: number): void {
    const player = session.players.get(playerId);
    if (!player) {
      return;
    }
    const blindAmount = Math.min(amount, player.chips);
    player.chips -= blindAmount;
    player.state =
      blindAmount < amount ? PlayerState.AllIn : PlayerState.Active;
    const game = this.getGame(session.id);
    if (game) {
      game.bets.set(playerId, blindAmount);
      game.currentBet = Math.max(game.currentBet, blindAmount);
    }
    const actionMsg = serializeAction(
      playerId,
      "blind",
      blindAmount,
      blindAmount,
      player.chips
    );
    for (const p of session.players.values()) {
      p.ws?.send(actionMsg);
    }
  }

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

    // Reject out-of-turn actions
    if (playerId !== game.actingPlayerId) {
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
        const isAllIn = callAmt >= player.chips;
        player.chips -= callAmt;
        player.state = isAllIn ? PlayerState.AllIn : PlayerState.Active;
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
        const alreadyIn = game.bets.get(playerId) ?? 0;
        const totalTarget = amount;
        const addAmount = Math.max(0, totalTarget - alreadyIn);
        const addAmt = Math.min(addAmount, player.chips);
        player.chips -= addAmt;
        player.state = PlayerState.Active;
        const newBet = alreadyIn + addAmt;
        game.bets.set(playerId, newBet);
        game.currentBet = Math.max(game.currentBet, newBet);
        break;
      }
      case "all_in": {
        const allInAmt = player.chips;
        player.chips = 0;
        player.state = PlayerState.AllIn;
        game.bets.set(playerId, (game.bets.get(playerId) ?? 0) + allInAmt);
        break;
      }
      default:
        return;
    }

    // Broadcast the performed action
    const potTotal = Array.from(game.bets.values()).reduce((a, b) => a + b, 0);
    const actionMsg = serializeAction(
      playerId,
      action,
      amount,
      potTotal,
      player.chips
    );
    for (const p of session.players.values()) {
      p.ws?.send(actionMsg);
    }

    // Determine next acting player
    const nextId = this.nextActingPlayer(session, game.actingPlayerId);
    game.actingPlayerId = nextId;
    if (this.isBettingRoundComplete(session, game)) {
      this.computePots(session);
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
      for (const p of session.players.values()) {
        p.ws?.send(turnMsg);
      }
    }
  }

  private isBettingRoundComplete(session: Session, game: Game): boolean {
    for (const player of session.players.values()) {
      if (
        player.state === PlayerState.Folded ||
        player.state === PlayerState.AllIn ||
        player.state === PlayerState.Eliminated ||
        player.state === PlayerState.Waiting ||
        player.state === PlayerState.Disconnected
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
    const pots: Pot[] = [];
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
    game.pots = pots;
    const serialized = serializePots(pots);
    for (const p of session.players.values()) {
      p.ws?.send(serialized);
    }
  }

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
      case RoundState.Finished:
        break;
      default:
        break;
    }
    if (next !== RoundState.Showdown && next !== RoundState.Finished) {
      const firstActive = this.firstActivePlayer(session);
      game.actingPlayerId = firstActive;
      const turnMsg = serializeTurn(firstActive, 0, 0, 0, 15_000);
      for (const p of session.players.values()) {
        p.ws?.send(turnMsg);
      }
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
      case RoundState.Showdown:
        return RoundState.Finished;
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
    for (const p of session.players.values()) {
      p.ws?.send(msg);
    }
  }

  private broadcastBoardTurn(session: Session, game: Game): void {
    const card = game.communityCards.at(-1);
    if (!card) {
      return;
    }
    const msg = serializeBoardTurn(this.cardToString(card));
    for (const p of session.players.values()) {
      p.ws?.send(msg);
    }
  }

  private broadcastBoardRiver(session: Session, game: Game): void {
    const card = game.communityCards.at(-1);
    if (!card) {
      return;
    }
    const msg = serializeBoardRiver(this.cardToString(card));
    for (const p of session.players.values()) {
      p.ws?.send(msg);
    }
  }

  private firstActivePlayer(session: Session): string {
    for (const p of session.players.values()) {
      if (p.state === PlayerState.Active) {
        return p.id;
      }
    }
    return "";
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
      if (
        player.state === PlayerState.Active ||
        player.state === PlayerState.Connected
      ) {
        return candidate;
      }
    }
    return currentId;
  }

  private handleShowdown(session: Session, game: Game): void {
    this.broadcastHoleCards(session);
    const { winners, winAmount } = this.evaluateAndDistribute(session, game);
    this.broadcastResultAndChips(session, winners, winAmount);
    this.eliminatePlayers(session);
    this.checkGameOver(session);
  }

  private broadcastHoleCards(session: Session): void {
    for (const p of session.players.values()) {
      if (p.holeCards.length === 2) {
        const holeMsg = `game hole ${this.cardToString(p.holeCards[0])} ${this.cardToString(p.holeCards[1])}`;
        p.ws?.send(holeMsg);
      }
    }
  }

  private evaluateAndDistribute(
    session: Session,
    game: Game
  ): { winners: { playerId: string; rank: string }[]; winAmount: number } {
    const handRanks: { playerId: string; rank: string; handValue: number }[] =
      [];
    for (const p of session.players.values()) {
      if (p.holeCards.length !== 2) {
        continue;
      }
      const rank = evaluateHand(p.holeCards, game.communityCards);
      const handValue = this.rankValue(rank);
      handRanks.push({ playerId: p.id, rank, handValue });
    }
    const maxValue = Math.max(...handRanks.map((h) => h.handValue));
    const winners = handRanks.filter((h) => h.handValue === maxValue);

    const totalPot = game.pots.reduce((sum, pot) => sum + pot.amount, 0);
    const winAmount = Math.floor(totalPot / winners.length);

    for (const w of winners) {
      const player = session.players.get(w.playerId);
      if (player) {
        player.chips += winAmount;
      }
    }
    return {
      winners: winners.map((w) => ({ playerId: w.playerId, rank: w.rank })),
      winAmount,
    };
  }

  private broadcastResultAndChips(
    session: Session,
    winners: { playerId: string; rank: string }[],
    winAmount: number
  ): void {
    const resultEntries = winners.map((w) => ({
      playerId: w.playerId,
      winAmount,
      handRank: w.rank,
    }));
    const resultMsg = serializeResult(resultEntries);
    for (const p of session.players.values()) {
      p.ws?.send(resultMsg);
    }
    const chipsMsg = serializeChips(
      Array.from(session.players.values()).map((p) => ({
        playerId: p.id,
        chips: p.chips,
      }))
    );
    for (const p of session.players.values()) {
      p.ws?.send(chipsMsg);
    }
  }

  private eliminatePlayers(session: Session): void {
    let position = 1;
    for (const p of session.players.values()) {
      if (p.chips <= 0 && p.state !== PlayerState.Eliminated) {
        const elimMsg = serializeEliminated(p.id, position);
        for (const s of session.players.values()) {
          s.ws?.send(elimMsg);
        }
        p.state = PlayerState.Eliminated;
        position++;
      }
    }
  }

  private checkGameOver(session: Session): void {
    const alive = Array.from(session.players.values()).filter(
      (p) => p.chips > 0
    );
    if (alive.length === 1) {
      const overMsg = serializeGameOver(alive[0].id);
      for (const p of session.players.values()) {
        p.ws?.send(overMsg);
      }
      session.state = SessionState.Closed;
    }
  }

  private rankValue(rank: string): number {
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
