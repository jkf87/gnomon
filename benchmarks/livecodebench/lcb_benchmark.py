"""
LiveCodeBench Benchmark: Baseline vs Ouroboros vs Gnomon
20-task subset from LeetCode Easy, functional test execution (no Docker)
Uses `claude -p` CLI for auth (subscription mode)
"""

import json
import time
import subprocess
import traceback
import re
from datasets import load_dataset

SUBSET_SIZE = 20
MODEL = "claude-haiku-4-5-20251001"

# ── helpers ──────────────────────────────────────────────────────────────────

def call_claude(prompt: str) -> tuple[str, float]:
    t0 = time.time()
    result = subprocess.run(
        ["claude", "-p", prompt, "--model", MODEL],
        capture_output=True, text=True, timeout=90
    )
    elapsed = time.time() - t0
    if result.returncode != 0:
        raise RuntimeError(f"claude CLI error: {result.stderr[:200]}")
    return result.stdout.strip(), elapsed


def extract_code(text: str) -> str:
    if "```python" in text:
        return text.split("```python")[1].split("```")[0].strip()
    if "```" in text:
        return text.split("```")[1].split("```")[0].strip()
    return text.strip()


def get_method_name(starter_code: str) -> str:
    """Extract method name from class Solution starter code."""
    match = re.search(r'def (\w+)\(self', starter_code)
    return match.group(1) if match else None


def count_params(starter_code: str, method_name: str) -> int:
    """Count non-self parameters of the method."""
    match = re.search(rf'def {method_name}\(self(.*?)\)', starter_code)
    if not match:
        return 1
    params = match.group(1).strip().lstrip(',').strip()
    return len([p for p in params.split(',') if p.strip()]) if params else 0


def run_tests(code: str, test_cases: list, method_name: str, n_params: int = 1) -> bool:
    """Run functional test cases against generated Solution class."""
    namespace = {}
    try:
        exec(code, namespace)
        if 'Solution' not in namespace:
            return False
        sol = namespace['Solution']()
        method = getattr(sol, method_name, None)
        if not method:
            return False
        for tc in test_cases:
            inp = json.loads(tc['input'])
            expected = json.loads(tc['output'])
            # multi-param: input is a list of args → unpack
            # single-param: input IS the argument
            if n_params > 1 and isinstance(inp, list) and len(inp) == n_params:
                result = method(*inp)
            else:
                result = method(inp)
            if result != expected:
                return False
        return True
    except Exception:
        return False


def build_prompt(task: dict, prefix: str = "") -> str:
    title = task['question_title']
    content = task['question_content']
    starter = task['starter_code']
    return (
        f"{prefix}"
        f"Problem: {title}\n\n"
        f"{content}\n\n"
        f"Complete this Python class:\n{starter}\n"
    )


# ── conditions ───────────────────────────────────────────────────────────────

def run_baseline(task: dict, test_cases: list, method_name: str, n_params: int) -> dict:
    msg = build_prompt(task, "Implement the solution. Return ONLY the complete Python class code.\n\n")
    text, elapsed = call_claude(msg)
    code = extract_code(text)
    passed = run_tests(code, test_cases, method_name, n_params)
    return {
        "task_id": task['question_id'],
        "condition": "baseline",
        "passed": passed,
        "llm_calls": 1,
        "elapsed": elapsed,
    }


def run_ouroboros(task: dict, test_cases: list, method_name: str, n_params: int) -> dict:
    total_elapsed = 0

    msg1 = build_prompt(task, "Implement the solution. Return ONLY the complete Python class code.\n\n")
    draft_text, e1 = call_claude(msg1)
    total_elapsed += e1
    draft = extract_code(draft_text)

    msg2 = (
        f"Review this solution for correctness and edge cases. List any issues.\n\n"
        f"Problem: {task['question_title']}\n\n"
        f"Implementation:\n{draft}"
    )
    critique, e2 = call_claude(msg2)
    total_elapsed += e2

    msg3 = (
        f"Provide the final corrected implementation. Return ONLY the complete Python class.\n\n"
        f"Problem: {task['question_title']}\n\n"
        f"Previous implementation:\n{draft}\n\n"
        f"Issues found:\n{critique}"
    )
    final_text, e3 = call_claude(msg3)
    total_elapsed += e3

    final_code = extract_code(final_text)
    passed = run_tests(final_code, test_cases, method_name, n_params)
    return {
        "task_id": task['question_id'],
        "condition": "ouroboros",
        "passed": passed,
        "llm_calls": 3,
        "elapsed": total_elapsed,
    }


def run_gnomon(task: dict, test_cases: list, method_name: str, n_params: int) -> dict:
    total_elapsed = 0
    llm_calls = 0

    msg1 = (
        f"Given this coding problem, define a rubric of 4-5 measurable criteria "
        f"that a correct solution MUST satisfy. Be specific.\n\n"
        f"Problem: {task['question_title']}\n\n{task['question_content']}"
    )
    rubric, e1 = call_claude(msg1)
    total_elapsed += e1
    llm_calls += 1

    msg2 = (
        f"RUBRIC:\n{rubric}\n\n"
        f"Using the rubric above as your guide, implement the solution. "
        f"Return ONLY the complete Python class code.\n\n"
        + build_prompt(task)
    )
    draft_text, e2 = call_claude(msg2)
    total_elapsed += e2
    llm_calls += 1
    draft = extract_code(draft_text)

    msg3 = (
        f"You are a strict code reviewer. Check if this solution satisfies EACH rubric criterion.\n\n"
        f"RUBRIC:\n{rubric}\n\n"
        f"SOLUTION:\n{draft}\n\n"
        f"For each criterion write [PASS] or [FAIL] with one line reason. "
        f"End with VERDICT: PASS or VERDICT: FAIL."
    )
    verdict_text, e3 = call_claude(msg3)
    total_elapsed += e3
    llm_calls += 1

    if "VERDICT: FAIL" in verdict_text.upper():
        msg4 = (
            f"Your solution failed rubric verification. Fix the issues.\n\n"
            f"RUBRIC:\n{rubric}\n\n"
            f"FAILED SOLUTION:\n{draft}\n\n"
            f"VERIFICATION:\n{verdict_text}\n\n"
            f"Return ONLY the corrected complete Python class."
        )
        final_text, e4 = call_claude(msg4)
        total_elapsed += e4
        llm_calls += 1
        final_code = extract_code(final_text)
    else:
        final_code = draft

    passed = run_tests(final_code, test_cases, method_name, n_params)
    return {
        "task_id": task['question_id'],
        "condition": "gnomon",
        "passed": passed,
        "llm_calls": llm_calls,
        "elapsed": total_elapsed,
        "verdict": "FAIL" if "VERDICT: FAIL" in verdict_text.upper() else "PASS",
    }


# ── main ─────────────────────────────────────────────────────────────────────

def main():
    print("Loading LiveCodeBench dataset...")
    ds = load_dataset('livecodebench/code_generation', split='test')

    # Filter: hard difficulty, stdin/stdout style (not class-based)
    candidates = [
        t for t in ds
        if t['difficulty'] == 'hard'
        and t['public_test_cases']
        and isinstance(t['public_test_cases'], list)
        and t['public_test_cases'][0].get('testtype') == 'stdin'
    ]
    print(f"Filtered {len(candidates)} hard stdin/stdout tasks")

    # Stratified sample
    step = max(1, len(candidates) // SUBSET_SIZE)
    tasks = candidates[::step][:SUBSET_SIZE]
    print(f"Selected {len(tasks)} tasks")

    results = []
    runners = [run_baseline, run_ouroboros, run_gnomon]

    for i, task in enumerate(tasks):
        method_name = get_method_name(task['starter_code'])
        n_params = count_params(task['starter_code'], method_name)
        raw_tc = task['public_test_cases']
        test_cases = raw_tc if isinstance(raw_tc, list) else json.loads(raw_tc)

        print(f"\n[{i+1}/{len(tasks)}] {task['question_title']} ({method_name}, {n_params} params)")
        for runner in runners:
            cond = runner.__name__.replace("run_", "")
            try:
                r = runner(task, test_cases, method_name, n_params)
                results.append(r)
                status = "PASS" if r["passed"] else "FAIL"
                print(f"  {cond:10s}: {status}  ({r['llm_calls']} calls, {r['elapsed']:.1f}s)")
            except Exception as e:
                print(f"  {cond:10s}: ERROR - {e}")
                traceback.print_exc()
                results.append({
                    "task_id": task['question_id'],
                    "condition": cond,
                    "passed": False,
                    "llm_calls": 0,
                    "elapsed": 0,
                    "error": str(e),
                })
            time.sleep(0.3)

    out_path = "lcb_results.json"
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to {out_path}")

    print("\n" + "="*60)
    print("LIVECODEBENCH RESULTS (LeetCode Easy)")
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
