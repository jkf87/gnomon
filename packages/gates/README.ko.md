# @jkf87/gnomon-gates

[English](README.md) | **한국어**

**노몬의 TypeScript 게이트 엔진 — 에이전트 루프를 위한 Backward Design 평가 게이트.**

gnomon-gates는 평문 acceptance criteria(AC)에서 *판정 가능한* 평가 게이트를 도출하고, 사람 검수 없이 루프를 **닫을지(close)** **계속 돌릴지(continue)** 결정론적으로 판정한다.

핵심 아이디어는 교육학에서 왔다. [Backward Design](https://en.wikipedia.org/wiki/Backward_design)은 말한다 — 수업을 설계하기 전에 *수용 가능한 증거*부터 정의하라. gnomon-gates는 이걸 에이전트 루프에 적용한다: 모든 AC가 관측 가능한 pass/fail 조건, 증거 명세, calibration pair를 가진 게이트를 얻는다. "루프가 끝났다"가 감이 아니라 계산 가능한 판정이 된다.

## 왜 필요한가

에이전트 루프(Ralph 루프, 오토파일럿, 진화형 러너)는 전부 같은 난제를 공유한다: **루프는 언제 멈춰도 되는가?** "사용자가 주요 과업을 막힘없이 완료한다" 같은 정성 기준은 루프를 영원히 막거나, 대충 통과된다. gnomon-gates의 답:

- **정성 AC는 루브릭 게이트가 된다** — LLM-judge가 `ac_compliance` + `score ∈ [0,1]`를 반환한다. 교육 평가의 루브릭 기법 그대로.
- **게이트의 유효성은 구조가 아니라 행동이다**: 모든 게이트는 calibration pair(알려진 합격 예시 1개 + 불합격 예시 1개)를 갖는다. 판별하지 못하는 게이트는 스키마가 아무리 완비돼도 무효다.
- **혼합 종료 정책**: `critical` 게이트는 전부 통과해야 하고, 비(非)critical 통과율은 임계값을 넘어야 한다. 정성 게이트 하나가 루프를 인질로 잡을 수도, 실패한 critical 게이트가 묻힐 수도 없다.
- **높은 불확실성은 사람이 아니라 합의로 푼다**: `uncertainty > 0.3`이면 Stage-3 다중 판정자 합의(다수결 + 점수 평균)를 거쳐야 결과가 확정된다. `human_review_required`는 타입 수준에서 `false`다 — 설계 의도다.
- **content-hash 무효화**: AC 문구를 고치면 저장된 도출 게이트가 무효화되고 재도출이 강제된다. 같은 시드 + 같은 오버라이드 ⇒ 언제나 같은 게이트.

## 설치

```bash
npm install @jkf87/gnomon-gates
```

## 빠른 시작

```js
import { materializeEffectiveEvaluationGates, evaluateLoopClosure } from '@jkf87/gnomon-gates';
import { readFileSync } from 'node:fs';

// 1. 시드의 평문 AC에서 게이트를 도출한다
const seedYaml = readFileSync('seeds/backward-design-gates.seed.yaml', 'utf8');
const { effectiveGates, defaults } = materializeEffectiveEvaluationGates(seedYaml);
// -> AC마다 게이트 1개: {ac_hash, condition[], evidence, calibration, critical, verification_method, source}

// 2. 판정 결과를 넣으면 close/continue 결정이 나온다
const attempts = {
  [effectiveGates[0].ac_hash]: { stage2: { ac_compliance: true, score: 0.93, uncertainty: 0.12 } },
  // 불확실성 높은 루브릭 게이트는 Stage-3 합의 표를 가져와야 한다:
  [effectiveGates[1].ac_hash]: {
    stage2: { ac_compliance: true, score: 0.85, uncertainty: 0.62 },
    stage3_consensus: [
      { ac_compliance: true,  score: 0.90, uncertainty: 0.15 },
      { ac_compliance: true,  score: 0.84, uncertainty: 0.20 },
      { ac_compliance: false, score: 0.55, uncertainty: 0.30 },
    ],
  },
  // ...게이트마다 attempt 1개 — 빠지면 throw (판정 안 된 AC는 절대 통과 못 한다)
};

const result = evaluateLoopClosure(effectiveGates, attempts, defaults);
// result.decision           -> 'close' | 'continue'
// result.critical_failures  -> 실패한 critical 게이트의 해시 목록
// result.noncritical_pass_ratio
```

## 게이트 해석 규칙

AC별 effective 게이트는 고정된 우선순위로 병합된다:

```
override (사용자 작성) > derived (Backward Design 도출) > default (상속 정책)
```

기본값은 고정·동결이다: `satisfaction_threshold: 0.8`, `uncertainty_trigger: 0.3`, `noncritical_pass_ratio: 0.8`.

## API

| Export | 하는 일 |
|---|---|
| `materializeEffectiveEvaluationGates(seedYaml, options?)` | YAML 최상위 `acceptance_criteria` 문자열 목록을 파싱하고, AC마다 게이트 1개를 도출(content-hash 키), override > derived > default 병합 |
| `evaluateLoopClosure(gates, attemptsByHash, defaults)` | 결정론적 close/continue 판정: 미판정 게이트에 throw, 합의 해소, critical 실패 + 비critical 비율 계산 |
| `EvaluationGate`, `EvaluatedGateResult`, `LoopClosureResult`, `GateResolutionPolicy` 타입 | 게이트 온톨로지 전체 |

## 테스트

```bash
npm test   # 빌드 후 node --test — 12개 테스트
```

## 계보 (Provenance)

이 라이브러리는 [Ouroboros](https://github.com/Q00/ouroboros) 풀 루프로 명세되고 만들어졌다 — 소크라테스 인터뷰(모호도 0.55 → 0.20) → QA 정제 시드(0.92, 적대적 페르소나 검증 3회) → 자율 실행(6/6 AC) → 3단계 형식 검증(**APPROVED**, Stage-2 0.82). 이 라이브러리를 명세한 시드가 [`seeds/backward-design-gates.seed.yaml`](seeds/backward-design-gates.seed.yaml)에 들어 있고, 라이브러리 자신의 테스트가 그 시드를 판정한다. 뱀이 제 꼬리를 문다.

## 라이선스

MIT
