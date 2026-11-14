// Verbatim copy of the production prompt + tool schema from
// video-interview-app/src/lib/ai/scoring.ts and
// video-interview-app/src/lib/scoring/weights.ts. Every adapter builds its
// call from THIS module so prompt parity across Sonnet/Opus/Glimmer is
// structural, not a promise - a paraphrase measures the rewrite, not the
// model.

export const PARAMETER_WEIGHTS: Record<string, { weight: number; label: string }> = {
  content_relevance: { weight: 0.25, label: "Content & Structure" },
  delivery_confidence: { weight: 0.2, label: "Delivery & Confidence" },
  communication_clarity: { weight: 0.2, label: "Clarity & Fluency" },
  professionalism_appearance: { weight: 0.15, label: "Attire & Professionalism" },
  body_language: { weight: 0.2, label: "Posture & Body Language" },
};

export function weightedOverallScore(scores: Record<string, number>): number {
  const entries = Object.entries(scores);
  if (entries.length === 0) return 0;
  let totalWeight = 0;
  let weightedSum = 0;
  for (const [key, score] of entries) {
    const weight = PARAMETER_WEIGHTS[key]?.weight ?? 1 / entries.length;
    weightedSum += score * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

export const SCORE_TOOL_NAME = "submit_answer_score";
export const SCORE_TOOL_DESCRIPTION =
  "Submit structured scores (0-100) and qualitative notes for a candidate's mock interview answer.";

// Anthropic tool `input_schema` shape - identical JSON Schema body used to
// build the OpenAI-style `function.parameters` field in the oai-compat
// adapter, so the two are the same schema wearing different envelopes.
export const SCORE_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    content_relevance: { type: "integer", minimum: 0, maximum: 100 },
    content_relevance_notes: { type: "string" },
    delivery_confidence: { type: "integer", minimum: 0, maximum: 100 },
    delivery_confidence_notes: { type: "string" },
    communication_clarity: { type: "integer", minimum: 0, maximum: 100 },
    communication_clarity_notes: { type: "string" },
    professionalism_appearance: { type: "integer", minimum: 0, maximum: 100 },
    professionalism_appearance_notes: { type: "string" },
    body_language: { type: "integer", minimum: 0, maximum: 100 },
    body_language_notes: { type: "string" },
    overall_feedback: { type: "string" },
  },
  required: [
    "content_relevance",
    "content_relevance_notes",
    "delivery_confidence",
    "delivery_confidence_notes",
    "communication_clarity",
    "communication_clarity_notes",
    "professionalism_appearance",
    "professionalism_appearance_notes",
    "body_language",
    "body_language_notes",
    "overall_feedback",
  ],
};

export interface ScorePromptParams {
  questionText: string;
  referenceAnswer: string;
  transcript: string;
}

// Byte-for-byte the text block scoreAnswer() sends, minus the trailing image
// blocks (adapters append those themselves in their own content-block
// format). Verify this against a live production call with a text diff
// before trusting any comparison run - see AGENTS.md harness controls.
export function buildScorePromptText({
  questionText,
  referenceAnswer,
  transcript,
}: ScorePromptParams): string {
  return `You are an interview coach scoring a student's mock placement-interview answer.

Question: ${questionText}

Reference (ideal) answer, for grounding your assessment of content accuracy/completeness — do not require verbatim match, judge whether the key points were covered:
${referenceAnswer}

Candidate's spoken answer (transcript):
${transcript || "(no speech detected)"}

The images below are frames sampled from the candidate's webcam during their answer, in chronological order. Use them to assess posture, attire/professionalism, and expression/engagement.

Score each parameter 0-100 with brief notes, and a short overall_feedback paragraph (2-3 sentences) that is constructive and specific.`;
}

export interface ScoreBreakdownEntry {
  score: number;
  weight: number;
  label: string;
}

export function buildScoreBreakdown(
  input: Record<string, string | number>
): Record<string, ScoreBreakdownEntry> {
  const breakdown: Record<string, ScoreBreakdownEntry> = {};
  for (const key of Object.keys(PARAMETER_WEIGHTS)) {
    breakdown[key] = {
      score: Number(input[key] ?? 0),
      weight: PARAMETER_WEIGHTS[key].weight,
      label: PARAMETER_WEIGHTS[key].label,
    };
  }
  return breakdown;
}

export function buildFeedback(input: Record<string, string | number>): string {
  const notes = Object.keys(PARAMETER_WEIGHTS)
    .map((key) => `${PARAMETER_WEIGHTS[key].label}: ${input[`${key}_notes`] ?? ""}`)
    .join("\n");
  return `${input.overall_feedback ?? ""}\n\n${notes}`.trim();
}
