/**
 * Server-only Korean content for hidden-text quiz.
 * expectedAnswer is NEVER sent to the client.
 */

export interface HiddenTextEntry {
  word: string;
}

export const HIDDEN_TEXT_BANK: HiddenTextEntry[] = [
  { word: "라면" },
  { word: "호박" },
  { word: "별빛" },
  { word: "구름" },
  { word: "연필" },
];

export function normalizeKoreanAnswer(text: string): string {
  return text.trim().replace(/\s+/g, "").toLowerCase();
}

export function answersMatch(given: string, expected: string): boolean {
  const g = normalizeKoreanAnswer(given);
  const e = normalizeKoreanAnswer(expected);
  if (!g || !e) return false;
  return g === e || g.includes(e) || e.includes(g);
}
