import type { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiModelCandidates } from '@/lib/gemini-model';

function shouldTryNextGeminiModel(message: string): boolean {
  const lower = message.toLowerCase();
  if (lower.includes('api key') && (lower.includes('invalid') || lower.includes('not valid'))) {
    return false;
  }
  if (message.includes('401') || message.includes('403')) return false;
  if (message.includes('404') && lower.includes('not found')) return true;
  if (message.includes('429') || lower.includes('too many requests')) return true;
  if (lower.includes('resource_exhausted')) return true;
  if (message.includes('503') || lower.includes('unavailable')) return true;
  return false;
}

export async function generateGeminiText(
  genAI: GoogleGenerativeAI,
  prompt: string,
  options?: { responseMimeType?: 'application/json' }
): Promise<string> {
  const candidates = getGeminiModelCandidates();
  const errors: string[] = [];

  for (const modelId of candidates) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelId,
        ...(options?.responseMimeType
          ? { generationConfig: { responseMimeType: options.responseMimeType } }
          : {}),
      });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${modelId}: ${msg}`);
      if (shouldTryNextGeminiModel(msg)) continue;
      throw err instanceof Error ? err : new Error(msg);
    }
  }

  throw new Error(
    `All Gemini models failed (${candidates.join(' → ')}).\n${errors.join('\n')}\n` +
      'Try a comma-separated GEMINI_MODEL list, pick a model in Google AI Studio, or enable billing: https://ai.google.dev/gemini-api/docs/rate-limits'
  );
}
