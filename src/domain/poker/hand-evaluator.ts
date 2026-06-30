import type { Card } from "@/domain/cards/card";

export type HandRank =
  | "NONE"
  | "HIGH_CARD"
  | "PAIR"
  | "TWO_PAIR"
  | "THREE_OF_A_KIND"
  | "STRAIGHT"
  | "FLUSH"
  | "FULL_HOUSE"
  | "FOUR_OF_A_KIND"
  | "STRAIGHT_FLUSH"
  | "ROYAL_FLUSH";

/**
 * Placeholder hand evaluator. Returns "NONE" for now.
 * A full implementation would evaluate the best poker hand given the player's two private cards and the community board.
 */
export function evaluateHand(
  _playerCards: Card[],
  _boardCards: Card[]
): HandRank {
  // TODO: Implement real hand evaluation logic.
  return "NONE";
}
