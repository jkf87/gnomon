# @jkf87/gnomon-gates
**English** | [한국어](README.ko.md)

**Gnomon의 TypeScript 게이트 엔진 — Backward Design evaluation gates for agent loops.**

loopgate derives *judgeable* evaluation gates from plain-text acceptance criteria, then decides — deterministically, without human review — whether a work loop may **close** or must **continue**.

The core idea comes from pedagogy: [Backward Design](https://en.wikipedia.org/wiki/Backward_design) says you define the *acceptable evidence* before you design the work. loopgate applies that to agent loops: every acceptance criterion (AC) gets a gate with observable pass/fail conditions, an evidence specification, and a calibration pair — so "the loop is done" becomes a computable verdict instead of a vibe.

## Why

Agent loops (Ralph loops, autopilots, evolutionary runners) all share one hard problem: **when is the loop allowed to stop?** Qualitative criteria like *"users complete the main task without friction"* either block closure forever or get waved through. loopgate's answer:

- **Qualitative ACs become rubric gates** judged by an LLM-judge returning `ac_compliance` + `score ∈ [0,1]` — the rubric trick from educational assessment.
- **Gate validity is behavioral, not structural**: every gate carries a calibration pair (one known-passing, one known-failing example). A gate that can't discriminate is invalid no matter how complete its schema.
- **Mixed closure policy**: all `critical` gates must pass AND the non-critical pass ratio must meet a threshold. One flaky qualitative gate can't hold the loop hostage; one failed critical gate always keeps it open.
- **High uncertainty resolves through consensus, not humans**: `uncertainty > 0.3` requires Stage-3 multi-judge consensus (majority vote, averaged scores) before the result is final. `human_review_required` is typed as `false` — by design.
- **Content-hash invalidation**: editing an AC's text invalidates its stored derived gate and forces re-derivation. Same seed + same overrides ⇒ same effective gates, always.

## Install

```bash
npm install loopgate
```

## Quickstart

```js
import { materializeEffectiveEvaluationGates, evaluateLoopClosure } from 'loopgate';
import { readFileSync } from 'node:fs';

// 1. Derive gates from a seed's plain-string acceptance criteria
const seedYaml = readFileSync('seeds/backward-design-gates.seed.yaml', 'utf8');
const { effectiveGates, defaults } = materializeEffectiveEvaluationGates(seedYaml);
// -> one gate per AC: {ac_hash, condition[], evidence, calibration, critical, verification_method, source}

// 2. Feed judge results in, get a close-or-continue decision out
const attempts = {
  [effectiveGates[0].ac_hash]: { stage2: { ac_compliance: true, score: 0.93, uncertainty: 0.12 } },
  // a high-uncertainty rubric gate must bring Stage-3 consensus votes:
  [effectiveGates[1].ac_hash]: {
    stage2: { ac_compliance: true, score: 0.85, uncertainty: 0.62 },
    stage3_consensus: [
      { ac_compliance: true,  score: 0.90, uncertainty: 0.15 },
      { ac_compliance: true,  score: 0.84, uncertainty: 0.20 },
      { ac_compliance: false, score: 0.55, uncertainty: 0.30 },
    ],
  },
  // ...one attempt per gate — a missing attempt throws (no AC slips through unjudged)
};

const result = evaluateLoopClosure(effectiveGates, attempts, defaults);
// result.decision           -> 'close' | 'continue'
// result.critical_failures  -> hashes of failed critical gates
// result.noncritical_pass_ratio
```

## Gate resolution

Per AC, the effective gate is merged with fixed precedence:

```
override (user-authored) > derived (Backward Design derivation) > default (inherited policy)
```

Defaults are pinned and snapshot-frozen: `satisfaction_threshold: 0.8`, `uncertainty_trigger: 0.3`, `noncritical_pass_ratio: 0.8`.

## API

| Export | What it does |
|---|---|
| `materializeEffectiveEvaluationGates(seedYaml, options?)` | Parses top-level `acceptance_criteria` string list from YAML, derives one gate per AC (content-hash keyed), applies override > derived > default |
| `evaluateLoopClosure(gates, attemptsByHash, defaults)` | Deterministic close-or-continue: throws on unjudged gates, resolves consensus, computes critical failures + non-critical ratio |
| `EvaluationGate`, `EvaluatedGateResult`, `LoopClosureResult`, `EvaluationGateDefaults` types | The full gate ontology |

## Test

```bash
npm test   # builds then runs node --test — 12 tests
```

## Provenance

This library was specified and built through a full [Ouroboros](https://github.com/Q00/ouroboros) loop — Socratic interview (ambiguity 0.55 → 0.20) → QA-refined seed (score 0.92, 3 iterations with adversarial persona review) → autonomous execution (6/6 ACs) → 3-stage formal evaluation (**APPROVED**, Stage-2 score 0.82). The seed that specified it lives in [`seeds/backward-design-gates.seed.yaml`](seeds/backward-design-gates.seed.yaml) — and the library's own test suite judges it. The snake eats its tail.

## License

MIT
