import { PlayerState } from "../../utils/constants";
import type { Card } from "../cards/card";

export class Player {
  holeCards: Card[] = [];

  id: string;
  name: string;
  chips: number;
  state: PlayerState;
  ws?: any; // WebSocket connection, stored for sending messages
  seatPosition?: number;

  constructor(id: string, name: string, chips: number) {
    this.id = id;
    this.name = name;
    this.chips = chips;
    this.state = PlayerState.Connected;
    this.ws = undefined;
  }
}
