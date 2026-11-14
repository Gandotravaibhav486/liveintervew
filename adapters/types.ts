export interface FrameImage {
  base64: string;
  mediaType: "image/jpeg" | "image/png";
}

export interface ScoreAnswerParams {
  questionText: string;
  referenceAnswer: string;
  transcript: string;
  frames: FrameImage[];
}

export interface AnswerScoreResult {
  scoreBreakdown: Record<string, { score: number; weight: number; label: string }>;
  overallScore: number;
  feedback: string;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  reasoningTokens?: number;
  finishReason?: string;
  raw?: unknown;
}
