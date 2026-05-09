# gnomon

<p align="center">
  <img src="assets/nomon-hero.jpg" alt="gnomon — a sundial casting an evaluation shadow" width="560">
</p>

**Gnomon** — the needle of a sundial. When sunlight hits, the shadow becomes the answer.

Rubric-first evaluation harness for OpenClaw. Define what "good" looks like before writing a single line.

---

## What is Gnomon?

**gnomon** is the pin on a sundial — the first quantitative verifier in human history. It casts a shadow against a fixed reference (the sun), not against itself.

Gnomon applies that principle to AI evaluation: write the rubric first, then let the agent run. The harness measures output against ground truth — no LLM self-grading allowed past the threshold.

| | Gnomon |
|---|---|
| Philosophy | rubric-first (define success before writing) |
| Entry point | rubric.yaml |
| Loop | verifier → writer (repeat until PASS) |
| Measurement | quantitative / persona-LLM / human |
| Guard | blocks entry if LLM ratio > 70% |

---

## Quick Start

```bash
uvx --from git+https://github.com/jkf87/gnomon gnomon install
```

Then in OpenClaw: `/gnomon:setup`

---

## Usage

### Install & verify

```bash
# Install into OpenClaw (idempotent)
uvx --from git+https://github.com/jkf87/gnomon gnomon install

# Check installation health
gnomon doctor

# Uninstall
gnomon uninstall
```

### Build a rubric

```bash
# Generate a rubric.yaml scaffold
gnomon rubric new

# Validate before running (enforces label ratios)
gnomon rubric check rubric.yaml
```

Rules enforced at `rubric check`:
- `quantitative` items must be ≥ 30% — blocked otherwise
- `persona-llm` items must be ≤ 70% — blocked otherwise

### Run evaluations

```bash
# Run a task — spawns agents, writes report to .gnomon/runs/
gnomon run task.yaml

# Side-by-side comparison view
gnomon compare task.yaml

# Dry-run (no agent spawn, placeholder output)
gnomon run task.yaml --dry-run

# Print a stored report
gnomon report <run-id>
```

### Workflow

```
gnomon rubric new          # scaffold rubric.yaml
↓
gnomon rubric check        # validate label ratios
↓ (PASS only)
gnomon run task.yaml       # spawn agents → collect outputs
↓
writer → verifier loop     # iterate until PASS
↓
gnomon report <run-id>     # review final result
```

### task.yaml example

```yaml
task: "Generate 10 card-news slides"
goal_persona:
  role: "Office worker, 25–35"
  success_signal: "Core point summarisable in 5 seconds"
items:
  - id: r1
    label: quantitative
    description: "Font size >= 24 pt"
    pass_condition: "All text >= 24pt"
  - id: r2
    label: persona-llm
    description: "Persona can summarise in 5 s"
    pass_condition: "PASS"
  - id: r3
    label: human
    description: "Image–content tone match"
    pass_condition: "Reviewer approval"
taste_gate:
  spearman_threshold: 0.7
```

### Available gates

| Gate | Domain | Key signals |
|------|---------|-------------|
| `code_gate` | Software | test pass rate, lint score, complexity |
| `blog_gate` | Writing | readability, structure, originality |
| `translation_gate` | Translation | BLEU, terminology consistency |
| `ui_gate` | Design | contrast ratio, spacing, accessibility |
| `video_gate` | YouTube / Shorts | subtitle WER, audio LUFS, aspect ratio, chapter density |

---

## OpenClaw Skills (after install)

| Skill | Description |
|-------|-------------|
| `/gnomon:rubric` | Scaffold a rubric for a task |
| `/gnomon:verify-check` | Validate rubric.yaml |
| `/gnomon:run` | Run the full evaluation loop |
| `/gnomon:calibrate` | Taste-gate calibration (sample runs) |

---

## Development

```bash
git clone https://github.com/jkf87/gnomon
cd gnomon
pip install -e ".[dev]"
pytest tests/ -v          # 63 tests
```

---

## 한국어 가이드

**그노몬(gnomon)** — 해시계의 바늘. 태양 빛이 닿는 순간 그림자가 정답이 된다.

루브릭-퍼스트 방식의 OpenClaw 평가 하네스. 한 줄도 쓰기 전에 "좋다"의 기준을 먼저 정의한다.

### 그노몬이 뭔가요?

**그노몬(gnomon)**은 해시계의 바늘이다. 태양을 기준으로 그림자를 드리워 시간을 측정하는 도구 — 인류 최초의 정량 verifier. LLM에게 묻지 않고 ground truth에 직접 대조한다.

그노몬은 그 원리를 AI 하네스에 적용한다. `rubric.yaml`이 먼저, workflow가 나중이다.

| | 그노몬 |
|---|---|
| 철학 | rubric-first (평가 먼저, 작성 나중) |
| 진입점 | rubric.yaml |
| 루프 | verifier → writer (PASS할 때까지) |
| 측정 방식 | 정량 / 페르소나-LLM / 사람 |
| 차단 조건 | LLM 비율 70% 초과 시 진입 불가 |

### 빠른 시작

```bash
uvx --from git+https://github.com/jkf87/gnomon gnomon install
```

OpenClaw에서: `/gnomon:setup`

### 사용법

#### 설치 및 확인

```bash
gnomon install    # OpenClaw에 설치 (멱등)
gnomon doctor     # 설치 상태 진단
gnomon uninstall  # 제거
```

#### 루브릭 작성

```bash
gnomon rubric new               # rubric.yaml 스캐폴드 생성
gnomon rubric check rubric.yaml # 실행 전 검증 (라벨 비율 강제)
```

검증 규칙:
- `quantitative` 항목 최소 30% — 미달 시 진입 차단
- `persona-llm` 항목 최대 70% — 초과 시 차단

#### 평가 실행

```bash
gnomon run task.yaml            # 에이전트 spawn → 리포트 작성
gnomon compare task.yaml        # 나란히 비교 출력
gnomon run task.yaml --dry-run  # 드라이런 (에이전트 미생성)
gnomon report <run-id>          # 저장된 리포트 출력
```

#### 워크플로우

```
gnomon rubric new       # 루브릭 스캐폴드
↓
gnomon rubric check     # 라벨 비율 검증
↓ (PASS만 통과)
gnomon run task.yaml    # 에이전트 → 결과 수집
↓
writer → verifier 루프  # PASS까지 반복
↓
gnomon report <run-id>  # 최종 리포트 확인
```

### 평가 게이트

| 게이트 | 도메인 | 주요 신호 |
|--------|--------|-----------|
| `code_gate` | 코드 | 테스트 통과율, 린트, 복잡도 |
| `blog_gate` | 글쓰기 | 가독성, 구조, 독창성 |
| `translation_gate` | 번역 | BLEU, 용어 일관성 |
| `ui_gate` | 디자인 | 대비비, 여백, 접근성 |
| `video_gate` | 유튜브/쇼츠 | 자막 WER, 오디오 LUFS, 화면비, 챕터 밀도 |

---

## License

MIT — See `LICENSE` file.
