"""Tests for gnomon rubric module — eval-first harness."""
import pytest
from pathlib import Path
from openclaw_gnomon.rubric import RubricItem, Rubric, load_rubric, validate_rubric


def test_rubric_item_creation():
    """RubricItem can be created with required fields."""
    item = RubricItem(
        name="font size check",
        description="All text >= 24pt",
        method="quantitative",
        pass_condition="font_size >= 24",
    )
    assert item.name == "font size check"
    assert item.method == "quantitative"
    assert item.signal_fn is None


def test_rubric_item_with_signal_fn():
    """RubricItem accepts an optional signal_fn callable."""
    def my_signal():
        return True

    item = RubricItem(
        name="custom check",
        description="Custom signal",
        method="quantitative",
        pass_condition="returns True",
        signal_fn=my_signal,
    )
    assert item.signal_fn is my_signal
    assert item.signal_fn() is True


def test_rubric_creation():
    """Rubric dataclass holds task, persona, and items."""
    rubric = Rubric(
        task="Generate card news",
        persona="25-35yo office worker",
        items=[],
    )
    assert rubric.task == "Generate card news"
    assert rubric.items == []


def test_validate_rubric_llm_only_warning():
    """validate_rubric warns when ALL items are persona-llm."""
    items = [
        RubricItem(name=f"llm-{i}", description="", method="persona-llm", pass_condition="")
        for i in range(3)
    ]
    rubric = Rubric(task="Test task", persona="Tester", items=items)
    warnings = validate_rubric(rubric)
    assert len(warnings) == 1
    assert "persona-llm" in warnings[0]


def test_validate_rubric_mixed_no_warning():
    """validate_rubric returns no warnings when items are mixed methods."""
    items = [
        RubricItem(name="quant", description="", method="quantitative", pass_condition=""),
        RubricItem(name="llm", description="", method="persona-llm", pass_condition=""),
    ]
    rubric = Rubric(task="Test task", persona="Tester", items=items)
    warnings = validate_rubric(rubric)
    assert warnings == []


def test_validate_rubric_empty_items_warning():
    """validate_rubric warns when there are no items."""
    rubric = Rubric(task="Empty task", persona="Tester", items=[])
    warnings = validate_rubric(rubric)
    assert any("no items" in w.lower() for w in warnings)


def test_load_rubric_from_yaml(tmp_path):
    """load_rubric correctly parses a rubric.yaml file."""
    yaml_content = """
task: "Test workflow"
persona: "Dev tester"
items:
  - name: "Output exists"
    description: "File is created"
    method: quantitative
    pass_condition: "file exists"
  - name: "Quality check"
    description: "LLM review"
    method: persona-llm
    pass_condition: "score >= 7"
"""
    rubric_file = tmp_path / "rubric.yaml"
    rubric_file.write_text(yaml_content)

    rubric = load_rubric(rubric_file)
    assert rubric.task == "Test workflow"
    assert rubric.persona == "Dev tester"
    assert len(rubric.items) == 2
    assert rubric.items[0].name == "Output exists"
    assert rubric.items[0].method == "quantitative"
    assert rubric.items[1].method == "persona-llm"
