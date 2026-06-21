export function serializeGameInfo(
  players: { id: string; chips: number }[]
): string {
  const parts = ["game", "info", players.length.toString()];
  for (const p of players) {
    parts.push(p.id, p.chips.toString());
  }
  return parts.join(" ");
}

export function serializeRoundStart(
  dealerId: string,
  smallBlindId: string,
  bigBlindId: string,
  smallBlindAmount: number,
  bigBlindAmount: number,
  seatsCount: number,
  seatAssignments: { position: number; playerId: string }[]
): string {
  const parts = [
    "game",
    "round_start",
    dealerId,
    smallBlindId,
    bigBlindId,
    smallBlindAmount.toString(),
    bigBlindAmount.toString(),
    seatsCount.toString(),
  ];
  for (const seat of seatAssignments) {
    parts.push(seat.position.toString(), seat.playerId);
  }
  return parts.join(" ");
}

export function serializeHole(card1: string, card2: string): string {
  return `game hole ${card1} ${card2}`;
}

export function serializeTurn(
  actingPlayerId: string,
  toCallAmount: number,
  minRaiseToAmount: number,
  maxRaiseToAmount: number,
  actionTimeMs: number
): string {
  return `game turn ${actingPlayerId} ${toCallAmount} ${minRaiseToAmount} ${maxRaiseToAmount} ${actionTimeMs}`;
}

export function serializeAction(
  playerId: string,
  actionType: string,
  actionAmount: number,
  potTotalAmount: number,
  playerChipsAmount: number
): string {
  return `game action ${playerId} ${actionType} ${actionAmount} ${potTotalAmount} ${playerChipsAmount}`;
}

export function serializeBets(
  bets: { playerId: string; amount: number }[]
): string {
  const parts = ["game", "bets", bets.length.toString()];
  for (const b of bets) {
    parts.push(b.playerId, b.amount.toString());
  }
  return parts.join(" ");
}

export function serializePots(
  pots: { type: string; amount: number; eligible: string[] }[]
): string {
  const parts = ["game", "pots", pots.length.toString()];
  for (const pot of pots) {
    parts.push(
      pot.type,
      pot.amount.toString(),
      pot.eligible.length.toString(),
      ...pot.eligible
    );
  }
  return parts.join(" ");
}

export function serializeBoardFlop(
  card1: string,
  card2: string,
  card3: string
): string {
  return `game board_flop ${card1} ${card2} ${card3}`;
}

export function serializeBoardTurn(card: string): string {
  return `game board_turn ${card}`;
}

export function serializeBoardRiver(card: string): string {
  return `game board_river ${card}`;
}

export function serializeShowdown(
  revealed: { playerId: string; cards: [string, string] }[]
): string {
  const parts = ["game", "showdown", revealed.length.toString()];
  for (const r of revealed) {
    parts.push(r.playerId, r.cards[0], r.cards[1]);
  }
  return parts.join(" ");
}

export function serializeResult(
  winners: { playerId: string; winAmount: number; handRank: string }[]
): string {
  const parts = ["game", "result", winners.length.toString()];
  for (const w of winners) {
    parts.push(w.playerId, w.winAmount.toString(), w.handRank);
  }
  return parts.join(" ");
}

export function serializeChips(
  players: { playerId: string; chips: number }[]
): string {
  const parts = ["game", "chips", players.length.toString()];
  for (const p of players) {
    parts.push(p.playerId, p.chips.toString());
  }
  return parts.join(" ");
}

export function serializeEliminated(
  playerId: string,
  finishPosition: number
): string {
  return `game eliminated ${playerId} ${finishPosition}`;
}

export function serializeGameOver(winnerPlayerId: string): string {
  return `game over ${winnerPlayerId}`;
}
