# ADR 0004 — Image/video analysis is an opt-in, separately metered add-on

**Status:** proposed · **Date:** 2026-11-14

## Context
Frames are 63% of scoring input and 17% of unit cost (unit-economics, two independent measurements).
`body_language` correlates with transcript word count at ρ=0.573 and `professionalism_appearance`
at 0.508; both are graded from frames, so part of those scores is probably wrong. Faces are
sensitive under DPDP, and `weights.ts` currently gives these two dimensions 35% of the headline score.

## Decision
- Stage 6 is a separate "Presentation analysis" add-on, labelled beta, **off by default**.
- It is **excluded from the headline score** and shown separately.
- Metered as credits with a hard per-user cost cap.
- Gated by `frame-quality` so dark or empty frames are never sent.
- Needs separate consent, short retention, and no training on the data.

## Consequences
Core interview gets cheaper and defensible; the add-on is a pricing lever. `PARAMETER_WEIGHTS`
must be renormalised across the remaining three dimensions, which changes scores, so bump
`RUBRIC_VERSION`.

## Open question
Launch stage 6 with the 100-user test, or only after the golden set exists? Default: **after.**

## Kill criterion
If add-on opt-in is below 10% of users, or human labels disagree with it as much as with the
frame-based scores today, drop it.
