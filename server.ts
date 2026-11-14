// Local comparison UI. Serves the corpus over HTTP and fans a single case
// out to any subset of {Sonnet, Opus, Glimmer 4-bit, Glimmer 3-bit} so the
// four can be read side by side.
//
// Localhost only, and deliberately so: every payload here is a real
// student's face and speech.
import "dotenv/config";
import { createServer } from "node:http";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { scoreWithAnthropic, CLAUDE_MODELS } from "./adapters/anthropic.ts";
import { scoreWithOaiCompat } from "./adapters/oai-compat.ts";
import type { FrameImage } from "./adapters/types.ts";
import { PRESETS } from "./corpus/presets.ts";

const PORT = 5199;
const ROOT = import.meta.dirname;
const CORPUS_DIR = join(ROOT, "corpus");
const FRAMES_DIR = join(CORPUS_DIR, "frames");

interface CorpusCase {
  answer_id: string;
  subject: string;
  mode: string;
  question_text: string;
  reference_answer: string;
  transcript: string;
  transcript_length: number;
  frame_files: string[];
  stored_score_breakdown: Record<string, { score: number }>;
}

const cases: CorpusCase[] = JSON.parse(readFileSync(join(CORPUS_DIR, "cases.json"), "utf8"));

function loadFrames(answerId: string, limit?: number): FrameImage[] {
  const dir = join(FRAMES_DIR, answerId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .slice(0, limit)
    .map((f) => ({
      base64: readFileSync(join(dir, f)).toString("base64"),
      mediaType: "image/jpeg" as const,
    }));
}

// The four things under comparison. Glimmer's two quants are separate
// entries rather than a parameter because the memory gate showed they are
// genuinely different configurations: 4-bit needs the 4-frame cap to stay
// out of swap on 24GB, 3-bit has slightly more headroom.
const RUNNERS: Record<
  string,
  { label: string; run: (p: Parameters<typeof scoreWithAnthropic>[0]) => Promise<unknown> }
> = {
  sonnet: {
    label: "Sonnet 5 (hosted)",
    run: (p) => scoreWithAnthropic(p, CLAUDE_MODELS.sonnet),
  },
  opus: {
    label: "Opus 5 (hosted)",
    run: (p) => scoreWithAnthropic(p, CLAUDE_MODELS.opus),
  },
  "glimmer-4bit": {
    label: "Glimmer 30B Q4_K_XL (local)",
    run: (p) =>
      scoreWithOaiCompat(p, { model: "lmstudio-community/muse-glimmer-30b", maxFrames: 4 }),
  },
  "glimmer-3bit": {
    label: "Glimmer 30B Q3_K_XL (local)",
    run: (p) => scoreWithOaiCompat(p, { model: "unsloth/muse-glimmer-30b", maxFrames: 4 }),
  },
};

function json(res: import("node:http").ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) });
  res.end(payload);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (url.pathname === "/" || url.pathname === "/index.html") {
    const html = readFileSync(join(ROOT, "public", "index.html"));
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
    return;
  }

  if (url.pathname === "/api/cases") {
    json(
      res,
      200,
      cases.map((c) => ({
        answer_id: c.answer_id,
        subject: c.subject,
        mode: c.mode,
        transcript_length: c.transcript_length,
        frame_count: c.frame_files.length,
        question_text: c.question_text.slice(0, 120),
      }))
    );
    return;
  }

  if (url.pathname === "/api/case") {
    const id = url.searchParams.get("id");
    const c = cases.find((x) => x.answer_id === id);
    if (!c) return json(res, 404, { error: "case not found" });
    json(res, 200, c);
    return;
  }

  // Serves the actual webcam frames to the UI so a human can see what the
  // models saw - the spot-check control in AGENTS.md is only meaningful if
  // the images are visible alongside the scores.
  if (url.pathname.startsWith("/api/frame/")) {
    const [, , , answerId, file] = url.pathname.split("/");
    const path = join(FRAMES_DIR, answerId, file);
    if (!existsSync(path) || extname(file) !== ".jpg") return json(res, 404, { error: "no frame" });
    const buf = readFileSync(path);
    res.writeHead(200, { "Content-Type": "image/jpeg", "Content-Length": buf.length });
    res.end(buf);
    return;
  }

  if (url.pathname === "/api/presets") {
    json(res, 200, PRESETS);
    return;
  }

  if (url.pathname === "/api/score" && req.method === "POST") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const { caseId, runner, override } = JSON.parse(Buffer.concat(chunks).toString());

    const c = cases.find((x) => x.answer_id === caseId);
    if (!c) return json(res, 404, { error: "case not found" });
    const entry = RUNNERS[runner];
    if (!entry) return json(res, 400, { error: `unknown runner ${runner}` });

    // An override swaps in a hand-written question/reference/transcript
    // while keeping the selected case's real frames, so a synthetic
    // content-quality probe still exercises the vision path.
    const frames = loadFrames(caseId);
    try {
      const result = await entry.run({
        questionText: override?.questionText || c.question_text,
        referenceAnswer: override?.referenceAnswer || c.reference_answer,
        transcript: override?.transcript ?? c.transcript,
        frames,
      });
      json(res, 200, { runner, label: entry.label, result });
    } catch (err) {
      json(res, 500, { runner, label: entry.label, error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, () => {
  console.log(`Comparison UI on http://localhost:${PORT}`);
  console.log(`${cases.length} cases loaded (${cases.filter((c) => c.frame_files.length > 0).length} with frames)`);
});
