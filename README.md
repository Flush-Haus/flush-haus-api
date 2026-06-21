# Poker Server

## Overview

A Texas Hold'em poker server built with **Bun**, **TypeScript**, and **Elysia**. Communication follows a custom plain‑text protocol over WebSockets (see `PROTOCOLO.md`).

## Implementation Progress

- **Basic Elysia server** – health endpoint (`GET /`) and WebSocket route (`/ws`). *Implemented*.
- **Protocol parser** – tokenization and command parsing. *Implemented*.
- **Serializers** – functions to generate all required protocol messages. *Implemented*.
- **Domain models** – session, player, game, round, pot, card, and placeholder hand evaluator. *Implemented*.
- **Services** – session management, full game flow (round progression, betting, side‑pot calculation, hand evaluation, showdown, chip distribution, elimination, reconnection). *Implemented*.
- **WebSocket handler** – processes commands, supports `session create/join/info/reconnect`, game actions (`ready`, `fold`, `check`, `call`, `bet`, `raise`, `all_in`), and broadcasts protocol messages. *Implemented*.
- **Reconnection logic** – `session reconnect [playerId]` re‑binds a WebSocket to an existing player, restores state, and continues the match. *Implemented*.
- **Side‑pot handling** – `GameService.computePots` creates main and side pots according to the betting amounts, serialized with `game pots`. *Implemented*.
- **Hand evaluation** – basic evaluator (`evaluateHand`) identifies hand rank; full ranking logic can be expanded. *Implemented (basic placeholder).*.
- **Documentation** – `README.md` updated and `AGENTS.md` files added for every folder/subfolder. *Implemented*.

Further improvements can flesh out the hand evaluator, add more robust error handling, and refine side‑pot distribution during showdown.
