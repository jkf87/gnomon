# @jkf87/gnomon-gates

**English** | [한국어](README.ko.md)

**A tool that grades an AI's work and decides, on your behalf: "OK, this is done."**

---

## What problem does this solve?

These days you can hand work to an AI. Say "build me a homepage" and the AI writes code, fixes it, and fixes it again — working in cycles. This repeating cycle is called a **"loop."**

But that raises a tricky question:

> **"Hey AI... how long are you going to keep going? Is this actually done?"**

A human could sit there and check every round, but then what was the point of automating? And if you ask the AI "are you done?", it always says "Yes! It's perfect!" (AIs tend to grade their own work generously.)

**gnomon-gates makes that call for you.** Like grading an exam, it builds a scoring sheet first. If the AI's work passes the criteria, the answer is **"done!" (close)**. If not: **"go again!" (continue)**.

## Why is it called "gnomon"?

A **gnomon** is the needle of a sundial. When sunlight hits the rod, its shadow *is* the time. Nobody guesses "hmm, feels like about 3 o'clock" — the answer comes out automatically, measured against a fixed reference (the sun). It was humanity's first automatic measuring instrument.

This tool works the same way. Not human gut feeling, but a **reference decided in advance** — and "done / not done" comes out automatically.

## The core idea: write the scoring sheet first

Think about how a teacher grades an essay. A good teacher writes the **scoring sheet (a rubric)** *before* grading:

> - Is the spelling correct? (10 points)
> - Is the topic clear? (30 points)
> - Are there supporting arguments? (30 points)
> ...

Now anyone grading gets similar scores, and students know what to aim for.

In education this is called **Backward Design**: instead of "teach first, figure out grading later," you first decide **what evidence counts as passing**, and design the work backward from there.

gnomon-gates applies this to AI work:

1. It takes a to-do list (e.g. "existing files must not break"), and
2. for each item it automatically builds a **gate** (a checkpoint). One gate contains:
   - **Pass conditions** — what must be observed to pass (e.g. "all tests pass")
   - **Evidence** — what to look at when judging (e.g. "the test run output")
   - **A calibration pair** — one sample that should pass and one that should fail, stored with the gate like an answer key, so the grader itself can be sanity-checked.
3. When the AI finishes, every gate gets scored, and an **overall verdict** comes out: done (close) or go again (continue).

## Can it grade "feelings" too?

Yes — that's this tool's specialty.

"The button is blue" is easy to check by machine. But **"it should be easy to use"**? There's no single right answer for that.

gnomon-gates turns items like that into **rubric grading**. Just like grading an essay with a scoring sheet, an AI judge is handed the rubric and asked to score. The judge returns two things:

- **Compliance** — does it meet the standard? (yes/no)
- **Score** — between 0 and 1

You need **both** to pass: compliance must be "yes" **and** the score must be at least 0.8. A high score alone isn't enough.

And what if the judge says **"hmm... I'm not sure"** (reports high uncertainty)? We don't call a human. We **call in more judges.** It's like gymnastics or figure skating: not one judge but a panel, each scoring independently, then combined. The rules:

- **Compliance** is decided by **majority vote**, and
- the **final score** is the **average** of the panel's scores (their uncertainty is averaged the same way).

The first judge's own score and vote are set aside — only the new panel's results count. And even then, no human steps in. Running fully automatic is the whole point.

## How is the final verdict made?

Just like school has required subjects and electives, gates come in two kinds:

| Kind | Rule |
|---|---|
| **Critical gates** | **If even one fails → "go again!", no exceptions** |
| Regular gates | 8 out of 10 (80%) or more must pass |

Why mix the two?

- If *everything* had to pass → one fuzzy item could keep the loop running **forever**.
- If we only looked at the average → something truly important could fail and **still pass when it shouldn’t**.

So we combine them: the important things always, the rest sufficiently.

## One more thing: no sneaky edits

What happens if someone edits the to-do list? Say, quietly changing "100 tests pass" to "10 tests pass"?

gnomon-gates remembers each item's **fingerprint (content-hash)**. Just like every person's fingerprint is unique, every sentence has its own fingerprint. Change the content even slightly — anything beyond tidying up spaces and blank lines — and the fingerprint changes too.

When a sentence changes, here's what happens: **the gate built for the old sentence no longer matches, so it's never used again.** The new sentence gets a new gate — freshly generated, or a simple backup gate (a "default" gate) stands in until then. Either way, **an edited sentence can never quietly inherit its old grades.** Same input, same gates, every time — you can't lower the bar in secret.

## How was this tool built?

Fun fact: this tool was itself **built by an AI automation loop.** Using [Ouroboros](https://github.com/Q00/ouroboros), it went through a requirements interview, then a blueprint (a "seed"), then autonomous AI development, then 3-stage verification (mechanical checks → AI grading → majority vote when unsure). The final verdict: **APPROVED**.

The very blueprint used to build this tool ships in [`seeds/backward-design-gates.seed.yaml`](seeds/backward-design-gates.seed.yaml) — and this tool's own test suite grades that blueprint. **The thing grades the blueprint that created it** — exactly what "ouroboros" (the snake eating its own tail) means.

## Glossary

| Term | Plain meaning |
|---|---|
| loop | An AI repeating work: do, check, fix, repeat |
| AC (acceptance criteria) | The to-do list that doubles as pass conditions: "done means this" |
| gate | A checkpoint. One AC turned into a gradable form |
| rubric | A scoring sheet. Makes fuzzy things gradable |
| compliance | The judge’s yes/no answer: does the work meet the standard? |
| LLM-judge | The AI referee doing the grading. LLM = "large language model," an AI like ChatGPT |
| critical | Marks a must-pass item. If it fails, it's back to work |
| calibration pair | A sample pair (one pass + one fail) used to sanity-check the grader |
| content-hash | A sentence's fingerprint. Unique per sentence, like a human fingerprint |
| uncertainty | How unsure the judge says it is. High = "I don't really know" |
| close / continue | The final verdict: OK to finish / keep working |

---

## Developer guide starts here

(If you don't code, you can stop reading — everything above is the whole story.)

### Install

```bash
npm install @jkf87/gnomon-gates
```

### Quickstart

```js
import { materializeEffectiveEvaluationGates, evaluateLoopClosure } from '@jkf87/gnomon-gates';
import { readFileSync } from 'node:fs';

// Step 1. Build gates automatically from a to-do list (acceptance_criteria in a YAML file)
const seedYaml = readFileSync('seeds/backward-design-gates.seed.yaml', 'utf8');
const { effectiveGates, defaults } = materializeEffectiveEvaluationGates(seedYaml);
// One gate per item:
// {ac_hash(fingerprint), condition(pass conditions), evidence, calibration(sample pair),
//  critical(must-pass?), verification_method(grading method), source(where the gate came from)}

// Step 2. Feed in grading results, get the final verdict
const attempts = {
  // A confident grading result (uncertainty <= 0.3 → finalized as-is)
  [effectiveGates[0].ac_hash]: { stage2: { ac_compliance: true, score: 0.93, uncertainty: 0.12 } },

  // A high-uncertainty case (uncertainty > 0.3): a panel of judges is required
  // (if the panel results are missing, this throws an error).
  // Compliance = majority vote (2:1 "yes" here), final score = average.
  [effectiveGates[1].ac_hash]: {
    stage2: { ac_compliance: true, score: 0.85, uncertainty: 0.62 },
    stage3_consensus: [
      { ac_compliance: true,  score: 0.90, uncertainty: 0.15 },
      { ac_compliance: true,  score: 0.84, uncertainty: 0.20 },
      { ac_compliance: false, score: 0.55, uncertainty: 0.30 },
    ],
    // Note: the average score here is (0.90+0.84+0.55)/3 ≈ 0.76, below 0.8.
    // Even though the majority voted "yes" on compliance, the score condition fails,
    // so this gate FAILS — a demonstration that BOTH compliance AND score are required.
  },
  // Important: every gate needs exactly one grading result.
  // (The referenced seed has 6 items, so to actually run this you must either provide
  //  attempts for all 6 gates or call evaluateLoopClosure(effectiveGates.slice(0, 2), ...).)
  // A missing attempt throws — no item can sneak past ungraded.
};

const result = evaluateLoopClosure(effectiveGates, attempts, defaults);
// result.decision                -> 'close' (done) or 'continue' (go again)
// result.critical_failures      -> hashes of failed critical gates
// result.noncritical_pass_ratio -> pass ratio of regular gates
```

### When gates overlap — precedence rules

If one item has more than one gate, exactly one is chosen, in this order:

```
written by the user (override) > auto-derived (derived) > fallback (default)
```

The default settings are pinned:

| Setting | Value | Meaning |
|---|---|---|
| `satisfaction_threshold` | 0.8 | Per-item passing score. Compliance (ac_compliance) must be true AND the score must be at least this value |
| `uncertainty_trigger` | 0.3 | If the judge's stated uncertainty **exceeds** this value, the panel vote kicks in |
| `noncritical_pass_ratio` | 0.8 | Regular gates: at least 80% must pass |

### API

| Function / type | What it does |
|---|---|
| `materializeEffectiveEvaluationGates(seedYaml, options?)` | Reads the top-level `acceptance_criteria` string list from YAML, derives one gate per item (content-hash keyed), applies the precedence rules |
| `evaluateLoopClosure(gates, attemptsByHash, defaults)` | Collects grading results into a close-or-continue verdict. Throws on missing attempts, handles panel votes automatically, computes critical failures and the pass ratio |
| `EvaluationGate`, `EvaluatedGateResult`, `LoopClosureResult`, `EvaluationGateDefaults` | The full set of gate type definitions |

### Test

```bash
npm test   # builds, then runs 12 tests
```

## License

MIT — free to use, modify, and share.
