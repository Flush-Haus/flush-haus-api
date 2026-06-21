import type { WSHandler } from "elysia";
import { parseMessage } from "../server/parser/parser";
import { sessionService } from "../services/sessionService";
import { gameService } from "../services/gameService";
import {
  serializeOk,
  serializeError,
  serializeSessionCreated,
  serializeSessionJoined,
  serializeSessionInfo,
} from "../protocol/serializer/sessionSerializer";
import { PlayerState } from "../utils/constants";

// Map WebSocket instances to player IDs for quick lookup
const wsToPlayer = new Map<any, string>();

export const pokerWs: WSHandler = {
  open(ws) {
    console.log("WebSocket connection opened", ws.id);
  },
  close(ws) {
    console.log("WebSocket connection closed", ws.id);
    const playerId = wsToPlayer.get(ws);
    if (playerId) {
      const session = sessionService.getSessionByPlayer(playerId);
      if (session) {
        const player = session.players.get(playerId);
        if (player) player.state = PlayerState.Disconnected;
      }
    }
    wsToPlayer.delete(ws);
  },
  async message(ws, message) {
    const text = typeof message === "string" ? message : "";
    const cmd = parseMessage(text);
    if (!cmd) {
      ws.send(serializeError(text, "ERR_INVALID_PARAMS", []));
      return;
    }
    const { domain, action, params } = cmd;
    const playerId = wsToPlayer.get(ws);

    try {
      if (domain === "session") {
        switch (action) {
          case "create": {
            const [playerName] = params;
            const { sessionId, playerId } = sessionService.createSession(playerName, ws);
            wsToPlayer.set(ws, playerId);
            ws.send(serializeSessionCreated(sessionId, playerId));
            ws.send(serializeOk(text));
            break;
          }
          case "join": {
            const [sessionId, playerName] = params;
            const result = sessionService.joinSession(sessionId, playerName, ws);
            if (result) {
              wsToPlayer.set(ws, result.playerId);
              ws.send(serializeSessionJoined(sessionId, result.playerId));
              ws.send(serializeOk(text));
            } else {
              ws.send(serializeError(text, "ERR_SESSION_NOT_FOUND", []));
            }
            break;
          }
          case "info": {
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
                serializeSessionInfo(session.id, session.state, session.ownerId, players)
              );
            } else {
              ws.send(serializeError(text, "ERR_SESSION_NOT_FOUND", []));
            }
            break;
          }
          case "reconnect": {
            const [reconnectId] = params;
            const ok = sessionService.reconnectPlayer(reconnectId, ws);
            if (ok) {
              wsToPlayer.set(ws, reconnectId);
              ws.send(serializeOk(text));
            } else {
              ws.send(serializeError(text, "ERR_PLAYER_NOT_IN_SESSION", []));
            }
            break;
          }
          default:
            ws.send(serializeError(text, "ERR_UNKNOWN_COMMAND", []));
        }
      } else if (domain === "game") {
        if (!playerId) {
          ws.send(serializeError(text, "ERR_PLAYER_NOT_IN_SESSION", []));
          return;
        }
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
      } else {
        ws.send(serializeError(text, "ERR_UNKNOWN_COMMAND", []));
      }
    } catch (e) {
      console.error(e);
      ws.send(serializeError(text, "ERR_UNKNOWN_COMMAND", []));
    }
  },
};
