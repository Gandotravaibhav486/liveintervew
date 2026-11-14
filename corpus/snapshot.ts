// Freezes the scored-answer corpus to disk before purgeSessionFrames() (in
// the source app, src/lib/ai/score-live-session.ts) deletes more frames out
// from under us. Read-only against Supabase — never writes back.
//
// Batch-mode frames live on answers.frames_extracted. Live-mode frames live
// on live_turns.frames_extracted and have to be re-aggregated per question
// with the same union-across-turns-then-cap-at-8 logic the app itself uses
// (src/lib/interview/assemble-question-media.ts), because live scoring never
// copies the final frame list onto the answers row.
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const MAX_FRAMES = 8;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OUT_DIR = join(import.meta.dirname, "..", "corpus");
const FRAMES_DIR = join(OUT_DIR, "frames");

interface LiveTurnRow {
  session_question_id: string | null;
  turn_index: number;
  speaker: string;
  text: string;
  frames_extracted: string[] | null;
}

function selectLiveFrames(perTurnPaths: string[][]): string[] {
  const selected: string[] = [];
  let round = 0;
  while (selected.length < MAX_FRAMES) {
    let pickedAny = false;
    for (const paths of perTurnPaths) {
      if (selected.length >= MAX_FRAMES) break;
      if (round < paths.length) {
        selected.push(paths[round]);
        pickedAny = true;
      }
    }
    if (!pickedAny) break;
    round += 1;
  }
  return selected;
}

async function main() {
  mkdirSync(FRAMES_DIR, { recursive: true });

  const { data: sessions, error: sessErr } = await supabase
    .from("interview_sessions")
    .select("id, mode, role, company, interview_type, status");
  if (sessErr) throw new Error(sessErr.message);
  const sessionById = new Map(sessions!.map((s) => [s.id, s]));

  const { data: questions, error: qErr } = await supabase
    .from("session_questions")
    .select("id, session_id, question_text, reference_answer, subject, question_type, order_index");
  if (qErr) throw new Error(qErr.message);
  const questionById = new Map(questions!.map((q) => [q.id, q]));

  const { data: answers, error: aErr } = await supabase
    .from("answers")
    .select(
      "id, question_id, transcript, answer_score_breakdown, answer_feedback, frames_extracted, feedback_status, recorded_at"
    )
    .eq("feedback_status", "complete");
  if (aErr) throw new Error(aErr.message);

  console.log(`Found ${answers!.length} scored answers.`);

  // Pre-fetch all live_turns once, grouped by session_question_id, instead of
  // one query per live-mode answer.
  const { data: allTurns, error: turnsErr } = await supabase
    .from("live_turns")
    .select("session_question_id, turn_index, speaker, text, frames_extracted")
    .order("turn_index", { ascending: true });
  if (turnsErr) throw new Error(turnsErr.message);
  const turnsByQuestion = new Map<string, LiveTurnRow[]>();
  for (const t of (allTurns ?? []) as LiveTurnRow[]) {
    if (!t.session_question_id) continue;
    const arr = turnsByQuestion.get(t.session_question_id) ?? [];
    arr.push(t);
    turnsByQuestion.set(t.session_question_id, arr);
  }

  const cases: Record<string, unknown>[] = [];
  let framesIntact = 0;
  let textOnly = 0;
  let framesDownloaded = 0;
  let framesMissing = 0;

  for (const answer of answers!) {
    const question = questionById.get(answer.question_id);
    if (!question) continue;
    const session = sessionById.get(question.session_id);
    if (!session) continue;

    let framePaths: string[] = [];
    let transcript = answer.transcript ?? "";
    let questionText = question.question_text;

    if (session.mode === "live") {
      const turns = (turnsByQuestion.get(question.id) ?? []).sort(
        (a, b) => a.turn_index - b.turn_index
      );
      const agentTurns = turns.filter((t) => t.speaker === "agent");
      const candidateTurns = turns.filter((t) => t.speaker === "candidate");
      if (agentTurns.length > 0) {
        questionText = agentTurns.map((t) => t.text).join(" ");
      }
      if (!transcript && candidateTurns.length > 0) {
        transcript = candidateTurns
          .map((t, i) => (i === 0 ? `Answer: ${t.text}` : `Follow-up answer ${i + 1}: ${t.text}`))
          .join("\n\n");
      }
      const perTurnPaths = candidateTurns.map((t) => t.frames_extracted ?? []);
      framePaths = selectLiveFrames(perTurnPaths);
    } else {
      framePaths = (answer.frames_extracted as string[] | null) ?? [];
    }

    const caseDir = join(FRAMES_DIR, answer.id);
    const downloadedFiles: string[] = [];
    if (framePaths.length > 0) {
      mkdirSync(caseDir, { recursive: true });
      for (let i = 0; i < framePaths.length; i++) {
        const path = framePaths[i];
        const { data: blob, error } = await supabase.storage.from("frames").download(path);
        if (error || !blob) {
          framesMissing++;
          continue;
        }
        const buf = Buffer.from(await blob.arrayBuffer());
        const filename = `${String(i).padStart(2, "0")}.jpg`;
        writeFileSync(join(caseDir, filename), buf);
        downloadedFiles.push(filename);
        framesDownloaded++;
      }
    }

    if (downloadedFiles.length > 0) framesIntact++;
    else textOnly++;

    cases.push({
      answer_id: answer.id,
      session_id: question.session_id,
      mode: session.mode,
      subject: question.subject,
      question_type: question.question_type,
      order_index: question.order_index,
      role: session.role,
      company: session.company,
      interview_type: session.interview_type,
      question_text: questionText,
      reference_answer: question.reference_answer,
      transcript,
      transcript_length: transcript.length,
      stored_score_breakdown: answer.answer_score_breakdown,
      stored_feedback: answer.answer_feedback,
      recorded_at: answer.recorded_at,
      frame_paths_at_snapshot_time: framePaths,
      frame_files: downloadedFiles,
    });
  }

  writeFileSync(join(OUT_DIR, "cases.json"), JSON.stringify(cases, null, 2));

  console.log(`\nSnapshot written to ${OUT_DIR}`);
  console.log(`  total cases:        ${cases.length}`);
  console.log(`  frame-intact:       ${framesIntact}`);
  console.log(`  text-only:          ${textOnly}`);
  console.log(`  frames downloaded:  ${framesDownloaded}`);
  console.log(`  frames missing:     ${framesMissing}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
