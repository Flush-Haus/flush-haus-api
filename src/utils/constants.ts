export const SessionState = {
  Lobby: "lobby",
  Running: "running",
  Closed: "closed",
} as const;

export type SessionState = (typeof SessionState)[keyof typeof SessionState];

export const PlayerState = {
  Connected: "connected",
  Disconnected: "disconnected",
  Waiting: "waiting",
  Active: "active",
  Folded: "folded",
  AllIn: "all_in",
  Eliminated: "eliminated",
} as const;

export type PlayerState = (typeof PlayerState)[keyof typeof PlayerState];

export const RoundState = {
  PreFlop: "pre_flop",
  Flop: "flop",
  Turn: "turn",
  River: "river",
  Showdown: "showdown",
  Finished: "finished",
} as const;

export type RoundState = (typeof RoundState)[keyof typeof RoundState];
