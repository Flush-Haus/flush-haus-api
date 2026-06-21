import { RoundState } from "../../utils/constants";
import type { Card } from "../cards/card";

export interface Pot {
  amount: number;
  eligiblePlayers: Set<string>;
  type: "MAIN" | "SIDE";
}

export class Game {
  sessionId: string;
  round: RoundState = RoundState.PreFlop;
  deck: Card[] = [];
  communityCards: Card[] = [];
  pots: Pot[] = [];
  bets: Map<string, number> = new Map();

  actingPlayerId?: string;

  constructor(sessionId: string, deck: Card[]) {
    this.sessionId = sessionId;
    this.deck = deck;
    this.pots = [];
  }
}
