import type { Card } from "@/domain/cards/card";
import { RoundState } from "@/utils/constants";

export interface Pot {
  amount: number;
  eligible: string[];
  type: "MAIN" | "SIDE";
}

export class Game {
  sessionId: string;
  round: RoundState = RoundState.PreFlop;
  deck: Card[] = [];
  communityCards: Card[] = [];
  pots: Pot[] = [];
  bets: Map<string, number> = new Map();
  currentBet = 0;
  dealerOffset = 0;
  actingPlayerId = "";

  constructor(sessionId: string, deck: Card[]) {
    this.sessionId = sessionId;
    this.deck = deck;
    this.pots = [];
  }
}
