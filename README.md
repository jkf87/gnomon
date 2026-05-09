# gnomon

<p align="center">
  <img src="assets/nomon-hero.jpg" alt="gnomon — a sundial casting an evaluation shadow" width="560">
</p>

**그노몬(gnomon)** — 해시계 바늘. 태양 빛이 닿는 순간 그림자가 정답이 된다.

Rubric-first evaluation harness for OpenClaw. Define what "good" looks like before writing a single line.

---

## What is gnomon?

**gnomon** is the pin on a sundial — the first quantitative verifier in human history. It casts a shadow against a fixed reference (the sun), not against itself.

gnomon applies that principle to AI evaluation: write the rubric first, then let the agent run. The harness measures output against ground truth — no LLM self-grading allowed past the threshold.

| | gnomon |
|---|---|
| Philosophy | rubric-first (define success before writing) |
| Entry point | rubric.yaml |
| Loop | verifier → writer (repeat until PASS) |
| Measurement | quantitative / persona-LLM / human |
| Guard | blocks entry if LLM ratio > 70% |

---

## 그노몬이 뭔가요?

**그노몬(gnomon)**은 해시계의 바늘이다. 태양을 기준으로 그림자를 드리워 시간을 측정하는 도구 — 인류 최초의 정량 verifier. LLM에게 묻지 않고 ground truth에 직접 대조한다.

그노몬은 그 원리를 AI 하네스에 적용한다. `rubric.yaml`이 먼저, workflow가 나중이다.

| | 그노몬 |
|---|---|
| 철학 | rubric-first (평가 먼저, 작성 나중) |
| 진입점 | rubric.yaml |
| 루프 | verifier → writer (PASS할 때까지) |
| 측정 방식 | 정량 / 페르소나-LLM / 사람 |
| 차단 조건 | LLM 비율 70% 초과 시 진입 불가 |

---

## Quick Start

```bash
uvx --from git+https://github.com/jkf87/gnomon gnomon install
```

Then in OpenClaw: `/gnomon:setup`

Done. You now have `/gnomon:rubric`, `/gnomon:verify-check`, `/gnomon:run`, `/gnomon:calibrate`.

Verify: `uvx --from git+https://github.com/jkf87/gnomon gnomon doctor`

Uninstall: `uvx --from git+https://github.com/jkf87/gnomon gnomon uninstall`

---

## Usage

### 1. Define your rubric

```bash
/gnomon:rubric "your task description"
```

gnomon generates a `rubric.yaml` with required labels: `quantitative`, `persona-llm`, and `human`. You edit it to match your success criteria.

### 2. Validate the rubric

```bash
/gnomon:verify-check rubric.yaml
```

Checks that:
- At least 30% of items are `quantitative`
- `persona-llm` items do not exceed 70%
- All required fields are present

**Only proceed if this returns PASS.**

### 3. Run the harness

```bash
/gnomon:run rubric.yaml
```

Kicks off the writer → verifier loop. The agent writes output, the verifier scores it against the rubric, and the loop repeats until all items PASS.

### 4. Calibrate

```bash
/gnomon:calibrate rubric.yaml --samples 5
```

Runs 5 sample evaluations and checks inter-rater reliability (Spearman correlation between human and LLM scores). If the correlation is below 0.7, gnomon forces a rubric refinement before allowing production runs.

---

### 사용법 (한국어)

#### 1. Rubric 정의

```bash
/gnomon:rubric "작업 설명"
```

`rubric.yaml`을 자동 생성합니다. `quantitative`, `persona-llm`, `human` 라벨이 반드시 포함되어야 하며, 성공 기준에 맞게 수정합니다.

#### 2. Rubric 검증

```bash
/gnomon:verify-check rubric.yaml
```

다음을 검사합니다:
- `quantitative` 항목이 최소 30% 이상인지
- `persona-llm` 항목이 70%를 넘지 않는지
- 필수 필드가 모두 채워졌는지

**PASS가 나온 경우에만 다음 단계로 진행합니다.**

#### 3. 하네스 실행

```bash
/gnomon:run rubric.yaml
```

writer → verifier 루프를 시작합니다. 에이전트가 결과물을 작성하면 verifier가 rubric 기준으로 채점하고, 모든 항목이 PASS될 때까지 반복합니다.

#### 4. Calibrate

```bash
/gnomon:calibrate rubric.yaml --samples 5
```

5개 샘플로 평가를 실행하고 사람 채점과 LLM 채점의 스피어만 상관계수를 측정합니다. 0.7 미만이면 프로덕션 실행 전에 rubric 리파인을 강제합니다.

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
goal_persona:
  role: "25~35세 직장인"
  success_signal: "5초 안에 핵심 1줄 요약 가능"
items:
  - id: r1
    label: quantitative
    description: "폰트 크기 >= 24pt"
    pass_condition: "모든 텍스트 >= 24pt"
  - id: r2
    label: persona-llm
    description: "페르소나가 5초 안에 핵심 요약 가능"
    pass_condition: "PASS"
  - id: r3
    label: human
    description: "이미지-내용 톤 일치"
    pass_condition: "검토자 승인"
taste_gate:
  spearman_threshold: 0.7
```

Rules enforced:
- `quantitative` 항목 최소 30% 필수 (미달 시 진입 차단)
- `persona-llm` 70% 초과 시 차단
- `taste_gate`: 사람 채점 vs LLM 채점 상관계수 0.7 미만이면 rubric 리파인 강제

---

## Building this Repo

Run tests: `pytest tests/ -v`

Auto-test: `bash verification/auto/run_install_test.sh`

---

## License

MIT — See `LICENSE` file.