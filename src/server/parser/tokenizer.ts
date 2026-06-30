const WHITESPACE = /\s+/;

export function tokenize(message: string): string[] {
  return message.trim().split(WHITESPACE);
}
