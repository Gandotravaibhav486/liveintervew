# ADR 0003 — Model choices, pinning and the Sonnet A/B

**Status:** proposed · **Date:** 2026-11-14

## Context
Measured 2026-09-19 (n=1 session, `research/unit-economics.md`): $0.235 per interview. Interviewer
50%, scoring 45%, STT 4%. Prices cited there: Opus 5 $5/$25, Sonnet 5 $2/$10 per MTok. Those docs
pin the Opus 5 / Sonnet 5 family; a newer family exists, so current numbers may be stale
**[verify prices and IDs before the pitch]**.

## Decision
1. All model IDs live in one `models.ts`. Never a floating alias. A provider upgrade is a version
   change we make deliberately (`MODEL_VERSION`, rules.md).
2. Interviewer stays on the strong model for the test. Run **Sonnet-class as an A/B** on real
   transcripts; do not swap on assumption.
3. Resume parsing, JD extraction and question selection move to a Haiku-class model.
4. Cache the stable agenda prefix on every interviewer call (the measured ~34% saving, free).
5. Re-run the golden set on the newest family before the pitch.

## Consequences
Cost path: $0.235 → about $0.156 with caching → about $0.115 without frames. The interviewer swap
is the only lever touching what users pay for, so it needs eval evidence.

## Kill criterion
Sonnet-class interviewer is rejected if golden-set probe quality drops by more than the measured
2σ noise band, or completion rate in the cohort falls.
