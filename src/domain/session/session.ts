import { SessionState } from "../../utils/constants";
import type { Player } from "../player/player";

export class Session {
  id: string;
  ownerId: string;
  players: Map<string, Player> = new Map();
  state: SessionState = SessionState.Lobby;
  smallBlind = 0;
  bigBlind = 0;
  startingChips = 0;
  bannedIds: Set<string> = new Set();

  constructor(id: string, ownerId: string) {
    this.id = id;
    this.ownerId = ownerId;
  }
}
