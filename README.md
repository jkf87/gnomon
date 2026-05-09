# openclaw-gnomon

Gnomon — 노몬. 해시계 바늘처럼, 무엇을 측정할지 먼저 세운다.

Rubric-first evaluation harness for OpenClaw. Define what "good" looks like before writing a single line.

---

## Why Gnomon?

A gnomon is the blade of a sundial — it casts a shadow that tells you where you are. In the same way, a rubric.yaml casts the shape of success before any work begins.

### Ouroboros vs Gnomon

| | Ouroboros | Gnomon |
|---|---|---|
| Philosophy | plan-first | rubric-first |
| Entry point | interview → seed.yaml | rubric.yaml |
| Loop driver | plan → code → test → verify | verifier → writer (repeat until PASS) |
| Measurement | implicit | explicit: 정량 / 페르소나-LLM / 사람 |
| Gate | none | LLM-only >70% blocks entry |

Gnomon enforces verifier-first discipline at the harness level — TDD applied to AI workflows.

---

## Quick Start

```bash
uvx --from git+https://github.com/jkf87/openclaw-gnomon openclaw-gnomon install
```

Then in OpenClaw: `/gnomon:setup`

Done. You now have `/gnomon:rubric`, `/gnomon:verify-check`, `/gnomon:run`, `/gnomon:calibrate`.

Verify: `uvx --from git+https://github.com/jkf87/openclaw-gnomon openclaw-gnomon doctor`

Uninstall: `uvx --from git+https://github.com/jkf87/openclaw-gnomon openclaw-gnomon uninstall`

---

## Workflow

```
/gnomon:rubric "카드뉴스 10장 생성"
↓
rubric.yaml 정의 (정량 + 페르소나-LLM + 사람 라벨 필수)
↓
/gnomon:verify-check rubric.yaml
↓ (PASS일 때만)
/gnomon:run rubric.yaml
↓
writer → verifier 루프 (통과할 때까지)
↓
/gnomon:calibrate rubric.yaml --samples 5
```

---

## rubric.yaml 예시

```yaml
task: "카드뉴스 10장 생성"
persona: "25-35세 직장인"
criteria:
  - name: "폰트 크기"
    measurement: "정량"
    spec: "모든 텍스트 >= 24pt"
  - name: "이해도"
    measurement: "페르소나-LLM"
    spec: "페르소나가 5초 안에 핵심 요약 가능"
  - name: "이미지 연관성"
    measurement: "사람"
    spec: "내용 톤과 이미지 톤 일치"
taste_residue_gate: 0.7  # 상관계수 임계값
```

Rules enforced by the harness:
- Every criterion must have a `measurement` label: `정량` / `페르소나-LLM` / `사람`
- If `페르소나-LLM` items exceed 70% of total criteria, entry is blocked
- `/gnomon:calibrate` checks human vs LLM scoring correlation; below 0.7 triggers rubric revision

---

## Building this Repo

Run tests: `pytest tests/ -v`

Auto-test: `bash verification/auto/run_install_test.sh`

---

## License

MIT — See `LICENSE` file.
