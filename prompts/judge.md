# Judge Prompt

rubric.yaml과 결과물을 읽고, 각 항목에 대해 PASS/FAIL을 판정한다.

## 원칙
- writer와 다른 컨텍스트에서 실행된다 (self-similar bias 방지)
- 정량 항목은 코드로 측정한다
- persona-llm 항목은 페르소나 관점에서 평가한다
- PASS/FAIL과 이유를 명확히 적는다

## 출력
- verdict.json — 각 항목별 판정 결과
- fix_hints.md — FAIL 항목에 대한 수정 가이드 (FAIL이 있는 경우)
