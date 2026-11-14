# ADR 0006 — Six-layer test strategy

**Status:** proposed · **Date:** 2026-11-14

## Context
At last audit, 70 passing tests plus a verification script missed a production outage that a code
review caught (agent-logs.md, 2026-09-12). The noise floor of the scoring judge is unmeasured
(evals.md). Tests passing is not evidence of quality here.

## Decision
1. **Unit:** state machine, weights, billing, quota. Port the existing tests.
2. **Recorded-fixture contract tests** per stage; provider calls replayed, so CI is free and deterministic.
3. **Golden-set evals:** freeze 30–50 anonymised transcripts (accent and fluency variety included),
   hand-score 10, run the judge 5 times, write the 2σ band at the top of evals.md.
4. **Playwright end-to-end** with Chrome fake media flags (`--use-fake-device-for-media-stream`).
5. **Failure injection:** force STT, model and storage failures; assert the user sees a failure,
   never a confident default score (rules.md hard limit 4).
6. **Load test** at 20 concurrent interviews; watch timeouts and p95 turn latency.

## Consequences
Only 18 sessions have ≥3 answers today, so the first noise-floor run may be at N=18 and must say so.
Layer 3 is the highest-value task and is a precondition for judging any model change.

## Kill criterion
If the measured judge noise band exceeds the effect sizes we care about, tighten rubric anchors or
average k runs before running any experiment.
