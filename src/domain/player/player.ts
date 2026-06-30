import type { Card } from "@/domain/cards/card";
import { PlayerState } from "@/utils/constants";

export interface WS {
  id: string;
  send(data: string): void;
}

export class Player {
  holeCards: Card[] = [];

  id: string;
  name: string;
  chips: number;
  state: PlayerState;
  ws?: WS;
  seatPosition?: number;

  constructor(id: string, name: string, chips: number) {
    this.id = id;
    this.name = name;
    this.chips = chips;
    this.state = PlayerState.Connected;
    this.ws = undefined;
  }
}
