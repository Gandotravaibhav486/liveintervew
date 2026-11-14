# Research basis for the scoring analysis

Five papers that bear directly on this harness, what each changes about the
design, and the methodologies adopted as a result. Compiled 11 Aug 2026.

---

## The five papers

### 1. Zhang, Koutsoumpis, Oostrom, Holtrop, Ghassemi & de Vries (2024)
**"Can Large Language Models Assess Personality From Asynchronous Video
Interviews? A Comprehensive Evaluation of Validity, Reliability, Fairness, and
Rating Patterns."** *IEEE Transactions on Affective Computing.*

Closest domain match that exists. GPT-3.5 / GPT-4 scoring real asynchronous
video interviews, evaluated on validity, reliability, fairness and rating
patterns.

**The finding that matters here:** zero-shot LLMs matched or beat task-specific
models at predicting *personality traits*, but **all R² values for job-related
competences and overall interview performance were below zero** — worse than
predicting the mean.

**Consequence for this project:** our rubric is job-related competence
(content relevance, clarity, professionalism), not personality. This is the
exact construct where LLM scoring has already been shown to fail. The harness
measures Glimmer's *agreement with Sonnet*; if Sonnet inherits this weakness,
strong agreement means reproducing a bad signal faithfully. That has to be
stated in the write-up rather than discovered by a reader.

### 2. Hickman, Bosch, Ng, Saef, Tay & Woo (2022)
**"Automated video interview personality assessments: Reliability, validity,
and generalizability investigations."** *Journal of Applied Psychology*,
107(8), 1323–1351. N = 1,073 across four samples, plus N = 99 for test–retest.

Established the reliability/validity/generalizability template for AVI scoring.
Key result: models trained on **interviewer-reports** showed consistent
convergent and discriminant validity; models trained on **self-reports** showed
almost none. Reliability across samples was mixed even for the better models.

**Consequence:** label source dominates. We have no labels at all, which is
why test–retest spread is the comparator — that choice is defensible and
matches this literature. But it also means we are measuring *reliability
without validity*, and the write-up must not slide from one to the other.

### 3. Shin, Kim, Cho, Kim & Oh (2026)
**"SurgCheck: Do Vision-Language Models Really Look at Images in Surgical
VQA?"** arXiv:2605.01911.

Three-condition ablation to test whether a VLM's multimodal performance is
actually visual: (a) **text-only** — images removed, question kept;
(b) **image perturbation** — shuffled or mismatched images; (c) indirect-cue
analysis. Found text-only performance stayed close to full-input performance
on several task types, i.e. apparent multimodal competence was linguistic
shortcut learning.

**Consequence:** our planned vision probe (same transcript, contrasting frame
sets) is weaker than this. Adopt the full three-condition design — a model
that scores `body_language` identically with matched frames, mismatched
frames, and no frames is not seeing anything, and 35% of the weighted score
is decoration. This applies to Sonnet exactly as much as to Glimmer.

### 4. Song, Lee & Jiao (2025)
**"Exploring LLM Autoscoring Reliability in Large-Scale Writing Assessments
Using Generalizability Theory."** arXiv:2507.19980. Two human raters and seven
AI raters scoring AP Chinese exam writing, holistic + three analytic scores.

Applies **generalizability theory (G-theory)** to decompose score variance
into components (person, rater, task, and their interactions) rather than
reporting a single agreement number. Humans were more reliable overall; LLMs
were reasonably consistent on some task types; **combining human and AI raters
improved reliability** over either alone.

**Consequence:** MAD alone confounds "this model is noisy" with "this case is
hard." G-theory separates them. With 26 cases × N repeats × 2 models we can
estimate rater variance vs case variance directly, which is a far more
informative answer than a single MAD number.

### 5. Yamauchi, Yano & Oyamada (2025)
**"An Empirical Study of LLM-as-a-Judge: How Design Choices Impact Evaluation
Reliability."** arXiv:2506.13639. Benchmarked on BIGGENBench and
EvalBiasBench.

Findings: **non-deterministic sampling improved alignment with human
preferences over deterministic (greedy) decoding**; chain-of-thought gave
minimal gains once evaluation criteria were well-specified; **the criteria
themselves were the dominant factor** in reliability.

**Consequence:** two direct design decisions. (1) Do not run the noise floor
at temperature 0 — that would report an artificially flat self-consistency
and make the +5 threshold trivially easy to pass. Sample at the same
temperature production uses. (2) Effort spent tightening the rubric text will
buy more than effort spent on prompt scaffolding — relevant to the "one tuning
round for Glimmer if it fails on format" allowance.

**Supporting:** quadratic weighted kappa is the established standard for
rater-agreement on ordinal score bands (see *Evaluating Quadratic Weighted
Kappa as the Standard Performance Metric for Automated Essay Scoring*,
EDM 2023). Reported LLM–human agreement across the essay-scoring literature
generally lands in the **0.30–0.80** range — worth holding in mind against our
Spearman ≥ 0.80 target, which sits at the optimistic end of what this
literature achieves between *humans and LLMs*, though we are asking for
LLM-to-LLM agreement, which should be easier.

---

## What the stored corpus already shows

Correlation matrix of the five rubric parameters across all 50 stored Claude
score breakdowns (single samples, so measurement error attenuates these —
true correlations are likely *higher*):

```
                              conten  delive  commun  profes  body_l
content_relevance               1.00    0.87    0.91    0.33    0.59
delivery_confidence             0.87    1.00    0.90    0.39    0.59
communication_clarity           0.91    0.90    1.00    0.38    0.57
professionalism_appearance      0.33    0.39    0.38    1.00    0.67
body_language                   0.59    0.59    0.57    0.67    1.00
```

mean off-diagonal r = 0.62

Two findings:

**A two-factor structure, not five.** `content_relevance`,
`delivery_confidence` and `communication_clarity` intercorrelate at 0.87–0.91.
At that level they are one latent factor with three names, and they carry
0.65 of the total weight. The rubric's effective dimensionality is closer to
2 than 5. This is textbook **halo effect** and it is the single most useful
thing to fix in the production rubric.

Note specifically that `delivery_confidence` — which the rubric intends to
capture *how* something was said — sits at 0.87–0.90 with the text parameters
and only 0.59 with `body_language`. It is being judged from the transcript,
not the video.

**The vision parameters are doing something real.** `professionalism_appearance`
and `body_language` correlate 0.67 with each other but only 0.33–0.39 with the
text cluster, and both have healthy spread (sd 13.2 and 14.7, full range
20–80 and 0–65). If Claude were ignoring frames these would be either constant
or slaved to the text factor. Neither holds. That is encouraging for the
premise of the whole project — but it is *correlational* evidence, and the
SurgCheck ablation is what would make it causal.

Also visible: `professionalism_appearance` is scored far more leniently
(mean 60.4) than everything else (33.0–43.4). A constant offset is
recalibratable, so this is a note rather than a problem.

---

## Top 5 methodologies to adopt

| # | Methodology | Replaces / adds to | Source |
|---|---|---|---|
| 1 | **G-theory variance decomposition** — partition score variance into case, rater(model), parameter and interaction components | raw MAD as the headline number | Song et al. 2025 |
| 2 | **Three-condition vision ablation** — matched frames / mismatched frames / text-only, run on *both* models | the planned two-condition frame-swap probe | SurgCheck 2026 |
| 3 | **Quadratic weighted kappa on score bands** + Spearman on weighted overall | unweighted kappa; QWK penalises distant disagreements correctly on ordinal bands | EDM 2023 |
| 4 | **Non-deterministic repeated sampling at production temperature**, N ≥ 3, for the noise floor | any temperature-0 baseline, which would understate spread | Yamauchi et al. 2025 |
| 5 | **Construct-validity checks: halo/factor structure + the fluent-but-wrong control** — inter-parameter correlation matrix per model, plus the planted-error transcript measuring the content-vs-delivery gap | nothing currently; this is the check that catches a model scoring fluency and calling it correctness | Hickman et al. 2022; Zhang et al. 2024 |

### On #5, concretely

The `fluent-wrong` preset already in `corpus/presets.ts` is the operational
form of this. Sonnet scored it content 40 / delivery 72 / clarity 70 — a
30-point gap, correctly identifying a confidently-delivered wrong answer.

That gap is the measurement. A model scoring it content ≈ delivery is
scoring polish. This discriminates far more sharply than agreement statistics
on the real corpus, where content quality and delivery quality are naturally
confounded (r ≈ 0.9, above) and a fluency-only scorer would look correct on
all 50 cases.

---

## One caveat to carry into the write-up

Every number this harness produces is **agreement with Sonnet**, not accuracy.
Zhang et al. found sub-zero R² for exactly our construct. If Sonnet is itself
poorly calibrated for job-related competence, Glimmer matching it within ±5
means Glimmer reproduces the same errors. The honest framing is:

> "Local serving does not degrade scores relative to the incumbent" —
> not "local serving scores correctly."

The only way to upgrade that claim is human labels on a subset. The planned
10-pair blind human spot-check is the seed of it; scaling it to ~30 cases with
two raters would make a genuine validity claim possible.
