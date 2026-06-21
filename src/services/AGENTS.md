# Services Folder

Contains business‑logic services that orchestrate domain models:
- `sessionService` – creates, joins, leaves, and starts sessions.
- `gameService` – initializes games, broadcasts state, and processes player actions (simplified).
These services are used by the WebSocket handler to fulfill protocol commands.