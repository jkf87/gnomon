# Verifier Builder Prompt

rubric.yaml에서 정량 항목을 읽고, 각 항목에 대해 Python checker 함수를 구현한다.

## 원칙
- 모든 checker는 입력을 받아 {"pass": bool, "score": float, "detail": str}을 반환한다
- LLM을 호출하지 않는다 — 순수 코드로 측정한다
- 실패 시 구체적인 원인을 detail에 적는다

## 출력
- checkers.py — 모든 checker 함수
- test_checkers.py — 각 checker에 대한 테스트
