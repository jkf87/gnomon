"""
Gnomon rubric module — eval-first harness.

Philosophy: rubric.yaml must exist before any workflow can run.
Like TDD (tests before code), Gnomon requires rubric before workflow.
"""
from __future__ import annotations

import warnings
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, List, Literal, Optional


@dataclass
class RubricItem:
    """A single evaluation criterion."""
    name: str
    description: str
    method: Literal["quantitative", "persona-llm", "human"]
    pass_condition: str
    signal_fn: Optional[Callable] = field(default=None, repr=False)


@dataclass
class Rubric:
    """A complete rubric for a Gnomon workflow."""
    task: str
    persona: str
    items: List[RubricItem] = field(default_factory=list)


def load_rubric(path: Path) -> Rubric:
    """Load a rubric from a YAML file."""
    import yaml

    with open(path) as f:
        data = yaml.safe_load(f)

    items = []
    for raw in data.get("items", []):
        item = RubricItem(
            name=raw["name"],
            description=raw.get("description", ""),
            method=raw["method"],
            pass_condition=raw.get("pass_condition", ""),
        )
        items.append(item)

    return Rubric(
        task=data.get("task", ""),
        persona=data.get("persona", ""),
        items=items,
    )


def validate_rubric(rubric: Rubric) -> List[str]:
    """Validate rubric and return a list of warning strings (empty = all good).

    Warnings (not errors):
    - All items use persona-llm only (100% LLM) — recommend adding quantitative signals.
    """
    warning_messages: List[str] = []
    total = len(rubric.items)
    if total == 0:
        warning_messages.append("Rubric has no items defined.")
        return warning_messages

    llm_count = sum(1 for item in rubric.items if item.method == "persona-llm")
    if total > 0 and llm_count == total:
        warning_messages.append(
            f"All {total} rubric items use method 'persona-llm'. "
            "Add at least one 'quantitative' signal to reduce LLM measurement bias."
        )

    return warning_messages
