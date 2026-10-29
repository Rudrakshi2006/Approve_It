import { randomInt } from "node:crypto";

/**
 * Unambiguous 32-character alphabet.
 * Excludes easily confused characters: 0, O, 1, I, L.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Generates an internal verification ID in the format: AP-XXXX-XXXX
 * using cryptographically secure random integers.
 */
export function generateVerificationId(): string {
  let part1 = "";
  for (let i = 0; i < 4; i++) {
    part1 += ALPHABET[randomInt(0, ALPHABET.length)];
  }

  let part2 = "";
  for (let i = 0; i < 4; i++) {
    part2 += ALPHABET[randomInt(0, ALPHABET.length)];
  }

  return `AP-${part1}-${part2}`;
}

export function isValidVerificationId(id: string): boolean {
  return /^AP-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/.test(id);
}
