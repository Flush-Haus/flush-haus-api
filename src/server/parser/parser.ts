import { tokenize } from "@/server/parser/tokenizer";

export interface Command {
  action: string;
  domain: string;
  params: string[];
}

export function parseMessage(message: string): Command | null {
  const tokens = tokenize(message);
  if (tokens.length < 2) {
    return null;
  }
  const [domain, action, ...params] = tokens;
  return { domain, action, params };
}
