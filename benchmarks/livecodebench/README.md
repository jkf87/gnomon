# LiveCodeBench Benchmark

Comparison of three conditions on LiveCodeBench Hard problems:

- **Baseline**: Single-shot Claude prompt
- **Ouroboros**: 3-call self-improvement loop (draft → critique → revise)
- **Gnomon**: Rubric-first structured verification (rubric → solve → verify → revise if needed)

## Results (Hard subset, 15 tasks)

| Condition | Pass Rate | LLM Calls |
|-----------|-----------|-----------|
| Baseline  | 9/15 (60.0%) | 1 |
| Ouroboros | 1/15 (6.7%)  | 3 |
| Gnomon    | 9/15 (60.0%) | 3–4 |

## Usage

```bash
cd benchmarks/livecodebench
pip install datasets
python lcb_hard_benchmark.py
```

Results are saved to `lcb_hard_results.json`.
