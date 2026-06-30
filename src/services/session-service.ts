import type { WS } from "@/domain/player/player";
import { Player } from "@/domain/player/player";
import { Session } from "@/domain/session/session";
import { PlayerState, SessionState } from "@/utils/constants";
import { generatePlayerId, generateSessionId } from "@/utils/id-generator";

class SessionService {
  private readonly sessions: Map<string, Session> = new Map();
  private readonly playerToSession: Map<string, string> = new Map();

  createSession(
    ownerName: string,
    ws: WS
  ): { sessionId: string; playerId: string } {
    const sessionId = generateSessionId();
    const playerId = generatePlayerId();
    const session = new Session(sessionId, playerId);
    session.state = SessionState.Lobby;

    const player = new Player(playerId, ownerName, 0);
    player.ws = ws;
    player.seatPosition = 1;
    session.players.set(playerId, player);
    this.sessions.set(sessionId, session);
    this.playerToSession.set(playerId, sessionId);
    return { sessionId, playerId };
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionByPlayer(playerId: string): Session | undefined {
    const sessionId = this.playerToSession.get(playerId);
    if (!sessionId) {
      return;
    }
    return this.sessions.get(sessionId);
  }

  joinSession(
    sessionId: string,
    playerName: string,
    ws: WS
  ): { playerId: string } | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    if (
      session.state !== SessionState.Lobby &&
      session.state !== SessionState.Running
    ) {
      return null;
    }
    if (session.bannedIds.has(playerName)) {
      return null;
    }
    const playerId = generatePlayerId();
    const player = new Player(playerId, playerName, session.startingChips);
    player.ws = ws;
    player.seatPosition = session.players.size + 1;
    session.players.set(playerId, player);
    this.playerToSession.set(playerId, sessionId);
    return { playerId };
  }

  reconnectPlayer(playerId: string, ws: WS): boolean {
    const session = this.getSessionByPlayer(playerId);
    if (!session) {
      return false;
    }
    const player = session.players.get(playerId);
    if (!player) {
      return false;
    }
    player.ws = ws;
    if (player.state === PlayerState.Disconnected) {
      player.state = PlayerState.Connected;
    }
    return true;
  }

  startSession(
    sessionId: string,
    smallBlind: number,
    bigBlind: number,
    startingChips: number
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    if (session.state !== SessionState.Lobby) {
      return false;
    }
    session.smallBlind = smallBlind;
    session.bigBlind = bigBlind;
    session.startingChips = startingChips;
    for (const p of session.players.values()) {
      p.chips = startingChips;
    }
    session.state = SessionState.Running;
    return true;
  }
}

export const sessionService = new SessionService();
