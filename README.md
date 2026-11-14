# interview-scoring-eval

Standalone eval harness comparing locally-served Muse Glimmer against the
production Sonnet 5 scorer for mock-interview answers. Reads
[video-interview-app](https://mockintervew.com)'s Supabase read-only;
nothing there changes.

Corpus snapshot taken 2026-08-11: 50 cases (26 batch / 24 live), 26 with
surviving frames, 24 text-only (frames already purged by the source app's
`purgeSessionFrames`). See `corpus/cases.json` after running the snapshot.

## Setup

```bash
npm install
cp .env.example .env   # fill in Supabase + Anthropic keys
npm run snapshot        # already run once — corpus/ is gitignored, real faces/speech
```

## Status (2026-11-14)

`run.ts`, `metrics.ts` and `report.ts` listed below are **not built yet** (the `run` and `report`
scripts in package.json point at files that do not exist). Present today: corpus snapshot script,
the Sonnet and OpenAI-compatible adapters, hand-written fluent-but-wrong presets, and the
comparison UI. See `docs/adr/0006-test-strategy.md` for the plan. `corpus/cases.json` and
`corpus/frames/` hold real students' data and are never committed; run `npm run snapshot` locally.

## Shape

- `corpus/snapshot.ts` — pulls scored answers + surviving frames to frozen JSON + JPEGs
- `adapters/anthropic.ts` — Sonnet 5, exact `scoreAnswer()` prompt + tool schema
- `adapters/oai-compat.ts` — OpenAI-compatible adapter (LM Studio locally, any host later)
- `run.ts` — adapter x repeats x corpus -> `results.jsonl`
- `metrics.ts` — MAD, bias, Spearman, kappa, self-consistency, conformance, latency, RAM
- `report.ts` — markdown table

`/corpus/` is gitignored — it contains real students' faces and speech.
