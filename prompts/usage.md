# Usage: Gnomon Workflows

Gnomon is eval-first: define the rubric before any workflow runs.

## New workflow flow

```
openclaw-gnomon rubric new          # 1. scaffold rubric.yaml
```

Edit `rubric.yaml` — specify what "done" looks like (task, persona, items with method labels).

```
openclaw-gnomon rubric check rubric.yaml   # 2. validate + label stats
```

Fix any warnings (e.g., 100% persona-llm items → add quantitative signals).

```
openclaw-gnomon run                 # 3. run (blocked without rubric.yaml)
```

The harness loops: verifier dry-run → writer executes → non-LLM signals validate → PASS or retry.

## Slash commands (after install)

```
/gnomon:setup
/gnomon:rubric "카드뉴스 10장 생성"
/gnomon:verify-check rubric.yaml
/gnomon:run rubric.yaml
/gnomon:calibrate rubric.yaml --samples 5
/gnomon:status <id>
/gnomon:cancel <id>
```

## method labels

- `quantitative` — non-LLM signal (file size, regex, pixel count, etc.)
- `persona-llm` — LLM judge simulating the target persona
- `human` — manual human review

Warning: 100% persona-llm items are flagged.
