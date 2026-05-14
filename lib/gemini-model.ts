/**
 * Models to try in order when GEMINI_MODEL is unset.
 * Different model IDs often have separate free-tier quota; 2.0 Flash is deprecated and may show limit 0.
 * @see https://ai.google.dev/gemini-api/docs/models/gemini
 */
export const GEMINI_MODEL_FALLBACK_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3-flash-preview',
] as const;

/**
 * If unset: use GEMINI_MODEL_FALLBACK_CHAIN.
 * If set to one id: use only that model (no fallback).
 * If comma-separated: try each in order (e.g. primary + fallbacks you choose).
 */
export function getGeminiModelCandidates(): string[] {
  const raw = process.env.GEMINI_MODEL?.trim();
  if (!raw) return [...GEMINI_MODEL_FALLBACK_CHAIN];
  if (raw.includes(',')) return raw.split(',').map((s) => s.trim()).filter(Boolean);
  return [raw];
}
