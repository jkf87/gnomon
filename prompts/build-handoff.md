# Build Handoff Prompt — openclaw-gnomon

Execute `docs/design.md` (gnomon eval-first harness spec):

- Repo: https://github.com/jkf87/openclaw-gnomon
- Package: `openclaw-gnomon`, entry point: `openclaw-gnomon`
- Philosophy: rubric.yaml first → verifier dry-run → writer → non-LLM validate → done

## Key deliverables

1. `src/openclaw_gnomon/rubric.py` — RubricItem, Rubric dataclasses + load_rubric, validate_rubric
2. `skill_template/rubric_template.yaml` — scaffold template for users
3. `cli.py` — `gnomon rubric new`, `gnomon rubric check`, `gnomon run` (blocked without rubric)
4. `tests/test_rubric.py` — RubricItem creation, validate_rubric LLM-only warning tests

## Build protocol

- TDD: test → fail → implement → pass → commit
- No placeholders; copy code verbatim
- Verification gate: 5 dims ≥95% (auto-test + 4 reviewers)
- GitHub push + user machine apply

## Deferred

MIT license, single README, no v1 CI, standard versions.
