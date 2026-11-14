// OpenAI-compatible adapter. Talks to whatever's behind LMSTUDIO_BASE_URL
// today (LM Studio, localhost); any other OpenAI-compatible host works
// unchanged tomorrow, so local-vs-hosted never forks the harness - only the
// baseUrl/model args change.
import OpenAI from "openai";
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

export interface OaiCompatOptions {
  baseUrl?: string;
  model: string;
  // The memory gate (see corpus/memory-gate-test.ts) found 8 frames pushes a
  // 24GB machine into swap regardless of quant - the KV cache for the image
  // tokens is the dominant cost, not model weights. 4 is the validated
  // fallback frame count for local Glimmer; leave undefined to send every
  // frame unchanged (used for hosted/Anthropic-scale comparisons).
  maxFrames?: number;
  // Reasoning models spend real completion budget on reasoning_content
  // before ever emitting the tool call - 1200 (Sonnet's setting) starves
  // that path. Confirmed empirically: 300 truncated with an empty answer,
  // 1500 completed cleanly.
  maxTokens?: number;
}

export async function scoreWithOaiCompat(
  { questionText, referenceAnswer, transcript, frames }: ScoreAnswerParams,
  { baseUrl = process.env.LMSTUDIO_BASE_URL ?? "http://localhost:1234/v1", model, maxFrames, maxTokens = 1500 }: OaiCompatOptions
): Promise<AnswerScoreResult> {
  const client = new OpenAI({ baseURL: baseUrl, apiKey: "not-needed" });

  const usedFrames = maxFrames ? frames.slice(0, maxFrames) : frames;
  const imageBlocks = usedFrames.map((frame) => ({
    type: "image_url" as const,
    image_url: { url: `data:${frame.mediaType};base64,${frame.base64}` },
  }));

  const start = Date.now();
  const completion = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    tools: [
      {
        type: "function",
        function: {
          name: SCORE_TOOL_NAME,
          description: SCORE_TOOL_DESCRIPTION,
          parameters: SCORE_TOOL_SCHEMA,
        },
      },
    ],
    // LM Studio rejects the named-function object form Anthropic's
    // tool_choice uses ("Supported string values: none, auto, required").
    // With exactly one tool registered, "required" forces the same call.
    tool_choice: "required",
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

  const choice = completion.choices[0];
  const toolCall = choice.message.tool_calls?.[0];
  if (!toolCall || toolCall.type !== "function") {
    throw new Error(
      `Model did not return a structured score (finish_reason: ${choice.finish_reason}). ` +
        `Raw content: ${choice.message.content?.slice(0, 200) ?? "(empty)"}`
    );
  }

  let input: Record<string, string | number>;
  try {
    input = JSON.parse(toolCall.function.arguments);
  } catch {
    throw new Error(`Model returned unparseable tool arguments: ${toolCall.function.arguments.slice(0, 300)}`);
  }

  const scoreBreakdown = buildScoreBreakdown(input);
  const scores = Object.fromEntries(Object.entries(scoreBreakdown).map(([k, v]) => [k, v.score]));

  const usage = completion.usage as
    | (OpenAI.CompletionUsage & { completion_tokens_details?: { reasoning_tokens?: number } })
    | undefined;

  return {
    scoreBreakdown,
    overallScore: weightedOverallScore(scores),
    feedback: buildFeedback(input),
    latencyMs,
    promptTokens: usage?.prompt_tokens,
    completionTokens: usage?.completion_tokens,
    reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens,
    finishReason: choice.finish_reason,
    raw: completion,
  };
}
