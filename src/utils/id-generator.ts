// Utility for generating sequential human‑readable identifiers

let sessionCounter = 0;
let playerCounter = 0;

/**
 * Generate a new session identifier like "session_000".
 */
export function generateSessionId(): string {
  const id = `session_${String(sessionCounter).padStart(3, "0")}`;
  sessionCounter++;
  return id;
}

/**
 * Generate a new player identifier like "player_000".
 */
export function generatePlayerId(): string {
  const id = `player_${String(playerCounter).padStart(3, "0")}`;
  playerCounter++;
  return id;
}
