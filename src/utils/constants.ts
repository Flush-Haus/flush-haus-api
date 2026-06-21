export enum SessionState {
  Lobby = "lobby",
  Running = "running",
  Closed = "closed",
}

export enum PlayerState {
  Connected = "connected",
  Disconnected = "disconnected",
  Waiting = "waiting",
  Active = "active",
  Folded = "folded",
  AllIn = "all_in",
  Eliminated = "eliminated",
}

export enum RoundState {
  PreFlop = "pre_flop",
  Flop = "flop",
  Turn = "turn",
  River = "river",
  Showdown = "showdown",
  Finished = "finished",
}
