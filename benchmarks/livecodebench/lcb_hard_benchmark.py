"""
LiveCodeBench Hard Benchmark: Baseline vs Ouroboros vs Gnomon
15-task hard subset, stdin/stdout style (no Docker)
Uses `claude -p` CLI for auth (subscription mode)
"""

import json
import time
import subprocess
import traceback
import sys
from datasets import load_dataset

SUBSET_SIZE = 15
MODEL = "claude-haiku-4-5-20251001"

# ── helpers ──────────────────────────────────────────────────────────────────

def call_claude(prompt: str) -> tuple[str, float]:
    t0 = time.time()
    result = subprocess.run(
        ["claude", "-p", prompt, "--model", MODEL],
        capture_output=True, text=True, timeout=120
    )
    elapsed = time.time() - t0
    if result.returncode != 0:
        raise RuntimeError(f"claude CLI error: {result.stderr[:200]}")
    return result.stdout.strip(), elapsed


def extract_code(text: str) -> str:
    """Extract Python code from response."""
    if "```python" in text:
        return text.split("```python")[1].split("```")[0].strip()
    if "```" in text:
        return text.split("```")[1].split("```")[0].strip()
    return text.strip()


def run_tests(code: str, test_cases: list) -> bool:
    """Run stdin/stdout test cases."""
    for tc in test_cases:
        try:
            result = subprocess.run(
                ["python3", "-c", code],
                input=tc['input'],
                capture_output=True,
                text=True,
                timeout=10
            )
            actual = result.stdout.strip()
            expected = tc['output'].strip()
            if actual != expected:
                return False
        except Exception:
            return False
    return True


def build_prompt(task: dict, prefix: str = "") -> str:
    title = task['question_title']
    content = task['question_content']
    return (
        f"{prefix}"
        f"Problem: {title}\n\n"
        f"Description:\n{content}\n\n"
        f"Write a Python solution that reads from stdin and writes to stdout."
    )


# ── conditions ───────────────────────────────────────────────────────────────

def run_baseline(task: dict, test_cases: list) -> dict:
    msg = build_prompt(task, "Solve this problem. Return ONLY the Python code.\n\n")
    text, elapsed = call_claude(msg)
    code = extract_code(text)
    passed = run_tests(code, test_cases)
    return {
        "task_id": task['question_id'],
        "condition": "baseline",
        "passed": passed,
        "llm_calls": 1,
        "elapsed": elapsed,
    }


def run_ouroboros(task: dict, test_cases: list) -> dict:
    total_elapsed = 0

    msg1 = build_prompt(task, "Solve this problem. Return ONLY the Python code.\n\n")
    draft_text, e1 = call_claude(msg1)
    total_elapsed += e1
    draft = extract_code(draft_text)

    msg2 = (
        f"Review this solution for correctness and edge cases:\n\n"
        f"Problem: {task['question_title']}\n\n"
        f"Solution:\n{draft}\n\n"
        f"List any issues you find."
    )
    critique, e2 = call_claude(msg2)
    total_elapsed += e2

    msg3 = (
        f"Provide the final corrected solution. Return ONLY the Python code.\n\n"
        f"Problem: {task['question_title']}\n\n"
        f"Issues found:\n{critique}"
    )
    final_text, e3 = call_claude(msg3)
    total_elapsed += e3

    final_code = extract_code(final_text)
    passed = run_tests(final_code, test_cases)
    return {
        "task_id": task['question_id'],
        "condition": "ouroboros",
        "passed": passed,
        "llm_calls": 3,
        "elapsed": total_elapsed,
    }


def run_gnomon(task: dict, test_cases: list) -> dict:
    total_elapsed = 0
    llm_calls = 0

    # Round 1: rubric
    msg1 = (
        f"Given this competitive programming problem, define a rubric of 4-5 criteria "
        f"that a correct solution MUST satisfy. Be very specific about algorithm requirements.\n\n"
        f"Problem: {task['question_title']}\n\n{task['question_content']}"
    )
    rubric, e1 = call_claude(msg1)
    total_elapsed += e1
    llm_calls += 1

    # Round 2: solve with rubric guidance
    msg2 = (
        f"RUBRIC (requirements for correctness):\n{rubric}\n\n"
        f"Solve this problem using the rubric above. Return ONLY the Python code.\n\n"
        + build_prompt(task)
    )
    draft_text, e2 = call_claude(msg2)
    total_elapsed += e2
    llm_calls += 1
    draft = extract_code(draft_text)

    # Round 3: verify against rubric
    msg3 = (
        f"Strictly check if this solution satisfies EACH rubric criterion.\n\n"
        f"RUBRIC:\n{rubric}\n\n"
        f"SOLUTION:\n{draft}\n\n"
        f"For each criterion: [PASS] or [FAIL] + reason.\n"
        f"End with VERDICT: PASS (all met) or VERDICT: FAIL."
    )
    verdict_text, e3 = call_claude(msg3)
    total_elapsed += e3
    llm_calls += 1

    # Round 4: revise if needed
    if "VERDICT: FAIL" in verdict_text.upper():
        msg4 = (
            f"Fix the solution to satisfy all rubric criteria.\n\n"
            f"RUBRIC:\n{rubric}\n\n"
            f"FAILED SOLUTION:\n{draft}\n\n"
            f"VERDICT:\n{verdict_text}\n\n"
            f"Return ONLY the corrected Python code."
        )
        final_text, e4 = call_claude(msg4)
        total_elapsed += e4
        llm_calls += 1
        final_code = extract_code(final_text)
    else:
        final_code = draft

    passed = run_tests(final_code, test_cases)
    return {
        "task_id": task['question_id'],
        "condition": "gnomon",
        "passed": passed,
        "llm_calls": llm_calls,
        "elapsed": total_elapsed,
    }


# ── main ─────────────────────────────────────────────────────────────────────

def main():
    print("Loading LiveCodeBench hard tasks...")
    ds = load_dataset('livecodebench/code_generation', split='test')

    candidates = []
    for t in ds:
        if t['difficulty'] != 'hard':
            continue
        tc = t['public_test_cases']
        if not tc:
            continue
        if isinstance(tc, str):
            tc = json.loads(tc)
        if isinstance(tc, list) and tc and tc[0].get('testtype') == 'stdin':
            candidates.append(t)

    print(f"Found {len(candidates)} hard stdin/stdout tasks")

    step = max(1, len(candidates) // SUBSET_SIZE)
    tasks = candidates[::step][:SUBSET_SIZE]
    print(f"Selected {len(tasks)} tasks for benchmark\n")

    results = []
    runners = [run_baseline, run_ouroboros, run_gnomon]

    for i, task in enumerate(tasks):
        raw_tc = task['public_test_cases']
        test_cases = raw_tc if isinstance(raw_tc, list) else json.loads(raw_tc)

        print(f"[{i+1}/{len(tasks)}] {task['question_title']}")
        for runner in runners:
            cond = runner.__name__.replace("run_", "")
            try:
                r = runner(task, test_cases)
                results.append(r)
                status = "PASS" if r["passed"] else "FAIL"
                print(f"  {cond:10s}: {status}  ({r['llm_calls']} calls, {r['elapsed']:.1f}s)")
            except Exception as e:
                print(f"  {cond:10s}: ERROR - {str(e)[:80]}")
                results.append({
                    "task_id": task['question_id'],
                    "condition": cond,
                    "passed": False,
                    "llm_calls": 0,
                    "elapsed": 0,
                    "error": str(e)[:200],
                })
            time.sleep(0.5)

    out_path = "lcb_hard_results.json"
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to {out_path}")

    print("\n" + "="*60)
    print("LIVECODEBENCH HARD RESULTS")
    print("="*60)
    for cond in ["baseline", "ouroboros", "gnomon"]:
        r = [x for x in results if x["condition"] == cond]
        n = len(r)
        passed = sum(1 for x in r if x.get("passed"))
        avg_calls = sum(x["llm_calls"] for x in r) / n if n else 0
        avg_time = sum(x["elapsed"] for x in r) / n if n else 0
        print(f"\n{cond.upper()}:")
        print(f"  Pass Rate:  {passed}/{n} ({passed/n*100:.1f}%)")
        print(f"  Avg Calls:  {avg_calls:.2f}")
        print(f"  Avg Time:   {avg_time:.1f}s")
    print("="*60)


if __name__ == "__main__":
    main()
