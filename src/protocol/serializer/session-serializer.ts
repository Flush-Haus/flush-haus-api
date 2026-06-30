export function serializeSessionCreated(
  sessionId: string,
  ownerId: string
): string {
  return `session created ${sessionId} ${ownerId}`;
}

export function serializeSessionJoined(
  sessionId: string,
  playerId: string
): string {
  return `session joined ${sessionId} ${playerId}`;
}

export function serializeSessionInfo(
  sessionId: string,
  sessionState: string,
  ownerId: string,
  players: { id: string; name: string; state: string }[]
): string {
  const parts = [
    "session",
    "info",
    sessionId,
    sessionState,
    ownerId,
    players.length.toString(),
  ];
  for (const p of players) {
    parts.push(p.id, p.name, p.state);
  }
  return parts.join(" ");
}

export function serializeOk(requestCommand: string): string {
  return `ok ${requestCommand}`;
}

export function serializeError(
  requestCommand: string,
  errorCode: string,
  details: string[] = []
): string {
  const parts = [
    "error",
    requestCommand,
    errorCode,
    details.length.toString(),
    ...details,
  ];
  return parts.join(" ");
}
