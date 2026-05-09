import json
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from openclaw_gnomon.installer import merge_mcp_entry, remove_mcp_entry


@pytest.fixture
def mcp_config_file(tmp_path):
    config = {"mcpServers": {"openclaw": {"type": "stdio", "command": "openclaw", "args": ["mcp", "serve"]}}}
    path = tmp_path / "mcp.json"
    with open(path, "w") as f:
        json.dump(config, f, indent=2)
    return path


def test_merge_mcp_entry_adds_gnomon(mcp_config_file):
    merge_mcp_entry(mcp_config_file)
    with open(mcp_config_file) as f:
        config = json.load(f)
    assert "gnomon" in config["mcpServers"]
    assert config["mcpServers"]["gnomon"]["type"] == "stdio"
    assert "openclaw-gnomon" in str(config["mcpServers"]["gnomon"]["args"])


def test_merge_mcp_entry_idempotent(mcp_config_file):
    merge_mcp_entry(mcp_config_file)
    with open(mcp_config_file) as f:
        config1 = json.load(f)
    merge_mcp_entry(mcp_config_file)
    with open(mcp_config_file) as f:
        config2 = json.load(f)
    assert config1 == config2


def test_merge_mcp_entry_preserves_other_servers(mcp_config_file):
    merge_mcp_entry(mcp_config_file)
    with open(mcp_config_file) as f:
        config = json.load(f)
    assert "openclaw" in config["mcpServers"]


def test_remove_mcp_entry_deletes_gnomon(mcp_config_file):
    merge_mcp_entry(mcp_config_file)
    remove_mcp_entry(mcp_config_file)
    with open(mcp_config_file) as f:
        config = json.load(f)
    assert "gnomon" not in config["mcpServers"]
    assert "openclaw" in config["mcpServers"]


def test_remove_mcp_entry_idempotent(mcp_config_file):
    merge_mcp_entry(mcp_config_file)
    remove_mcp_entry(mcp_config_file)
    remove_mcp_entry(mcp_config_file)
    with open(mcp_config_file) as f:
        config = json.load(f)
    assert "gnomon" not in config["mcpServers"]


def test_stage_skill_files_copies_skill_template(tmp_path):
    from openclaw_gnomon.installer import stage_skill_files
    skills_dir = tmp_path / "skills"
    skills_dir.mkdir(parents=True)
    stage_skill_files(skills_dir)
    skill_path = skills_dir / "gnomon" / "SKILL.md"
    assert skill_path.exists()
    with open(skill_path) as f:
        content = f.read()
    assert "gnomon" in content.lower()


def test_write_gnomon_config_creates_yaml(tmp_path):
    from openclaw_gnomon.installer import write_gnomon_config
    config_path = tmp_path / "config.yaml"
    write_gnomon_config(config_path)
    assert config_path.exists()
    with open(config_path) as f:
        import yaml
        config = yaml.safe_load(f)
    assert config["orchestrator"]["runtime_backend"] == "openclaw"
