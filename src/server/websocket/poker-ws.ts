import type { WSHandler } from "elysia";
import type { WS } from "@/domain/player/player";
import {
  serializeError,
  serializeOk,
  serializeSessionCreated,
  serializeSessionInfo,
  serializeSessionJoined,
} from "@/protocol/serializer/session-serializer";
import { parseMessage } from "@/server/parser/parser";
import { gameService } from "@/services/game-service";
import { sessionService } from "@/services/session-service";
import { PlayerState } from "@/utils/constants";

// Map connection id -> player id. Keyed by ws.id because Elysia hands out a
// fresh ws wrapper per event, so the object itself is not a stable Map key.
const wsToPlayer = new Map<string, string>();

function handleSessionCommand(
  ws: WS,
  action: string,
  params: string[],
  text: string
): void {
  switch (action) {
    case "create": {
      const [playerName] = params;
      const { sessionId, playerId } = sessionService.createSession(
        playerName,
        ws
      );
      wsToPlayer.set(ws.id, playerId);
      ws.send(serializeSessionCreated(sessionId, playerId));
      ws.send(serializeOk(text));
      break;
    }
    case "join": {
      const [sessionId, playerName] = params;
      const result = sessionService.joinSession(sessionId, playerName, ws);
      if (result) {
        wsToPlayer.set(ws.id, result.playerId);
        ws.send(serializeSessionJoined(sessionId, result.playerId));
        ws.send(serializeOk(text));
      } else {
        ws.send(serializeError(text, "ERR_SESSION_NOT_FOUND", []));
      }
      break;
    }
    case "info": {
      const playerId = wsToPlayer.get(ws.id);
      if (!playerId) {
        ws.send(serializeError(text, "ERR_PLAYER_NOT_IN_SESSION", []));
        break;
      }
      const session = sessionService.getSessionByPlayer(playerId);
      if (session) {
        const players = Array.from(session.players.values()).map((p) => ({
          id: p.id,
          name: p.name,
          state: p.state,
        }));
        ws.send(
          serializeSessionInfo(
            session.id,
            session.state,
            session.ownerId,
            players
          )
        );
      } else {
        ws.send(serializeError(text, "ERR_SESSION_NOT_FOUND", []));
      }
      break;
    }
    case "start": {
      const playerId = wsToPlayer.get(ws.id);
      const session = playerId
        ? sessionService.getSessionByPlayer(playerId)
        : undefined;
      if (!(session && session.ownerId === playerId)) {
        ws.send(serializeError(text, "ERR_NOT_OWNER", []));
        break;
      }
      const [sb, bb, chips] = params.map(Number);
      const ok = sessionService.startSession(
        session.id,
        sb || 0,
        bb || 0,
        chips || 0
      );
      if (!ok) {
        ws.send(serializeError(text, "ERR_INVALID_STATE", []));
        break;
      }
      const started = `session started ${sb} ${bb} ${chips}`;
      for (const p of session.players.values()) {
        p.ws?.send(started);
      }
      ws.send(serializeOk(text));
      break;
    }
    case "ping": {
      const [clientMs] = params;
      ws.send(`session pong ${clientMs} ${Date.now()}`);
      break;
    }
    case "reconnect": {
      const [reconnectId] = params;
      const ok = sessionService.reconnectPlayer(reconnectId, ws);
      if (ok) {
        wsToPlayer.set(ws.id, reconnectId);
        ws.send(serializeOk(text));
        // Send current session and game state to reconnected client
        const session = sessionService.getSessionByPlayer(reconnectId);
        if (session) {
          const players = Array.from(session.players.values()).map((p) => ({
            id: p.id,
            name: p.name,
            state: p.state,
          }));
          ws.send(
            serializeSessionInfo(
              session.id,
              session.state,
              session.ownerId,
              players
            )
          );
        }
      } else {
        ws.send(serializeError(text, "ERR_PLAYER_NOT_IN_SESSION", []));
      }
      break;
    }
    default:
      ws.send(serializeError(text, "ERR_UNKNOWN_COMMAND", []));
  }
}

function handleGameCommand(
  ws: WS,
  action: string,
  params: string[],
  text: string,
  playerId: string
): void {
  const session = sessionService.getSessionByPlayer(playerId);
  if (!session) {
    ws.send(serializeError(text, "ERR_SESSION_NOT_FOUND", []));
    return;
  }
  switch (action) {
    case "ready":
      gameService.startRound(session);
      ws.send(serializeOk(text));
      break;
    case "fold":
    case "check":
    case "call":
    case "bet":
    case "raise":
    case "all_in": {
      const amount = params[0] ? Number(params[0]) : 0;
      gameService.handleAction(session, playerId, action, amount);
      ws.send(serializeOk(text));
      break;
    }
    default:
      ws.send(serializeError(text, "ERR_UNKNOWN_COMMAND", []));
  }
}

export const pokerWs: WSHandler = {
  open(ws) {
    console.log("WebSocket connection opened", ws.id);
  },
  close(ws) {
    console.log("WebSocket connection closed", ws.id);
    const playerId = wsToPlayer.get(ws.id);
    if (playerId) {
      const session = sessionService.getSessionByPlayer(playerId);
      if (session) {
        const player = session.players.get(playerId);
        if (player) {
          player.state = PlayerState.Disconnected;
        }
      }
    }
    wsToPlayer.delete(ws.id);
  },
  message(ws, message) {
    const text = typeof message === "string" ? message : "";
    const cmd = parseMessage(text);
    if (!cmd) {
      ws.send(serializeError(text, "ERR_INVALID_PARAMS", []));
      return;
    }
    const { domain, action, params } = cmd;
    const playerId = wsToPlayer.get(ws.id);

    try {
      if (domain === "session") {
        handleSessionCommand(ws, action, params, text);
      } else if (domain === "game") {
        if (!playerId) {
          ws.send(serializeError(text, "ERR_PLAYER_NOT_IN_SESSION", []));
          return;
        }
        handleGameCommand(ws, action, params, text, playerId);
      } else {
        ws.send(serializeError(text, "ERR_UNKNOWN_COMMAND", []));
      }
    } catch (e) {
      console.error(e);
      ws.send(serializeError(text, "ERR_UNKNOWN_COMMAND", []));
    }
  },
};
