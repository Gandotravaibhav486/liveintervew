// One-off: exercises both adapters against a single real corpus case to
// confirm tool-call parsing works end to end before building anything on
// top. Not part of the pipeline.
import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { scoreWithAnthropic, CLAUDE_MODELS } from "./anthropic.ts";
import { scoreWithOaiCompat } from "./oai-compat.ts";
import type { FrameImage } from "./types.ts";

const CORPUS_DIR = join(import.meta.dirname, "..", "corpus");
const cases = JSON.parse(readFileSync(join(CORPUS_DIR, "cases.json"), "utf8"));

const caseId = process.argv[2] ?? "02a69835-15c9-4a20-b65a-17d131749f4f";
const c = cases.find((x: { answer_id: string }) => x.answer_id === caseId);
if (!c) throw new Error(`case ${caseId} not found`);

const frameDir = join(CORPUS_DIR, "frames", caseId);
let frames: FrameImage[] = [];
try {
  frames = readdirSync(frameDir)
    .sort()
    .map((f) => ({
      base64: readFileSync(join(frameDir, f)).toString("base64"),
      mediaType: "image/jpeg" as const,
    }));
} catch {
  // text-only case
}

const params = {
  questionText: c.question_text,
  referenceAnswer: c.reference_answer,
  transcript: c.transcript,
  frames,
};

const which = process.argv[3] ?? "both";

if (which === "anthropic" || which === "both") {
  console.log("\n=== Anthropic (Sonnet 5) ===");
  const result = await scoreWithAnthropic(params, CLAUDE_MODELS.sonnet);
  console.log(JSON.stringify(result, null, 2));
}

if (which === "oai" || which === "both") {
  console.log("\n=== OAI-compat (Glimmer 3-bit, 4 frames) ===");
  const result = await scoreWithOaiCompat(params, {
    model: "unsloth/muse-glimmer-30b",
    maxFrames: 4,
  });
  console.log(JSON.stringify(result, null, 2));
}
