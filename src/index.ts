import { Elysia } from "elysia";
import { pokerWs } from "./server/websocket/pokerWs";

// Initialize Elysia app
const app = new Elysia()
  // Health check endpoint
  .get("/", () => "Poker server is running")
  // WebSocket endpoint for Poker protocol
  .ws("/ws", pokerWs)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
