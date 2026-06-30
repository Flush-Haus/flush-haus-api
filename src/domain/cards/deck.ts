import type { Card, CardSuit, CardValue } from "@/domain/cards/card";

const values: CardValue[] = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "V",
  "D",
  "R",
  "A",
];

const suits: CardSuit[] = ["P", "O", "C", "E"];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const value of values) {
      deck.push({ value, suit });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const result = deck.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
