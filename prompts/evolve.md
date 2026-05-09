# Evolve Prompt — 양방향 진화

실행 결과를 분석해서 writer와 rubric을 모두 개선한다.

## 방향 1: 결과물 → Writer 개선
- judge가 FAIL 판정한 항목에 대해 writer 프롬프트를 수정한다
- 반복 패턴을 분석해서 writer가 자주 실패하는 원인을 찾는다

## 방향 2: 결과물 → Rubric 개선
- 사람이 항상 수동으로 PASS시키는 항목은 자동화 가능한지 검토
- judge와 사람의 판정이 자주 어긋나면 rubric이 모호한 것 → 분해
- taste residue gate: 사람 채점 vs LLM 채점 상관계수가 0.7 미만이면 rubric refine

## 출력
- rubric-v2.yaml — 개선된 rubric (변경 사항 주석 포함)
- writer-v2.md — 개선된 writer 프롬프트
