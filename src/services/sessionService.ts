import { Player } from "../domain/player/player";
import { Session } from "../domain/session/session";
import { PlayerState, SessionState } from "../utils/constants";
import { generatePlayerId, generateSessionId } from "../utils/idGenerator";

class SessionService {
  private readonly sessions: Map<string, Session> = new Map();
  private readonly playerToSession: Map<string, string> = new Map();

  createSession(
    ownerName: string,
    ws: any
  ): { sessionId: string; playerId: string } {
    const sessionId = generateSessionId();
    const playerId = generatePlayerId();
    const session = new Session(sessionId, playerId);
    session.state = SessionState.Lobby;

    const player = new Player(playerId, ownerName, 0);
    player.ws = ws;
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
    ws: any
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
    session.players.set(playerId, player);
    this.playerToSession.set(playerId, sessionId);
    return { playerId };
  }

  reconnectPlayer(playerId: string, ws: any): boolean {
    const session = this.getSessionByPlayer(playerId);
    if (!session) {
      return false;
    }
    const player = session.players.get(playerId);
    if (!player) {
      return false;
    }
    player.ws = ws;
    // Restore state if previously disconnected
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
    // Initialize chips for all players
    session.players.forEach((p) => (p.chips = startingChips));
    session.state = SessionState.Running;
    return true;
  }
}

export const sessionService = new SessionService();
