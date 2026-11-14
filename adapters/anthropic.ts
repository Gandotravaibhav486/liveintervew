import Anthropic from "@anthropic-ai/sdk";
import {
  SCORE_TOOL_NAME,
  SCORE_TOOL_DESCRIPTION,
  SCORE_TOOL_SCHEMA,
  buildScorePromptText,
  buildScoreBreakdown,
  buildFeedback,
  weightedOverallScore,
} from "./prompt.ts";
import type { AnswerScoreResult, ScoreAnswerParams } from "./types.ts";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const CLAUDE_MODELS = {
  sonnet: "claude-sonnet-5",
  opus: "claude-opus-5",
} as const;

export async function scoreWithAnthropic(
  { questionText, referenceAnswer, transcript, frames }: ScoreAnswerParams,
  model: string = CLAUDE_MODELS.sonnet,
  // 1200 is production's value (video-interview-app scoring.ts). Long answers
  // truncate at it - stop_reason "max_tokens" with overall_feedback missing
  // from the tool call, observed on real corpus cases. Overridable so the
  // harness can measure both production-faithful and untruncated behaviour.
  maxTokens = 1200
): Promise<AnswerScoreResult> {
  const imageBlocks = frames.map((frame) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: frame.mediaType,
      data: frame.base64,
    },
  }));

  const start = Date.now();
  const message = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    tools: [
      {
        name: SCORE_TOOL_NAME,
        description: SCORE_TOOL_DESCRIPTION,
        input_schema: SCORE_TOOL_SCHEMA,
      },
    ],
    tool_choice: { type: "tool", name: SCORE_TOOL_NAME },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: buildScorePromptText({ questionText, referenceAnswer, transcript }) },
          ...imageBlocks,
        ],
      },
    ],
  });
  const latencyMs = Date.now() - start;

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a structured score");
  }
  const input = toolUse.input as Record<string, string | number>;
  const scoreBreakdown = buildScoreBreakdown(input);
  const scores = Object.fromEntries(Object.entries(scoreBreakdown).map(([k, v]) => [k, v.score]));

  return {
    scoreBreakdown,
    overallScore: weightedOverallScore(scores),
    feedback: buildFeedback(input),
    latencyMs,
    promptTokens: message.usage.input_tokens,
    completionTokens: message.usage.output_tokens,
    finishReason: message.stop_reason ?? undefined,
    raw: message,
  };
}
