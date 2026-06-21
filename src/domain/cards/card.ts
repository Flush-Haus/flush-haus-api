export type CardValue =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "V"
  | "D"
  | "R"
  | "A";
export type CardSuit = "P" | "O" | "C" | "E"; // Paus, Ouros, Copas, Espadas

export interface Card {
  suit: CardSuit;
  value: CardValue;
}
