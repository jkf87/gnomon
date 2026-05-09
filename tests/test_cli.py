import os
import json
from pathlib import Path
from unittest.mock import patch
from typer.testing import CliRunner
from openclaw_gnomon.cli import app


runner = CliRunner()


def test_install_command_creates_skill_and_mcp(tmp_path):
    """CLI install command stages skill and merges MCP entry"""
    skills_dir = tmp_path / "skills"
    mcp_config = tmp_path / "mcp.json"
    gnomon_config = tmp_path / "config.yaml"

    mcp_config.parent.mkdir(parents=True, exist_ok=True)
    mcp_config.write_text(json.dumps({"mcpServers": {}}))

    with patch("openclaw_gnomon.cli.openclaw_skills_dir", return_value=skills_dir), \
         patch("openclaw_gnomon.cli.openclaw_mcp_config_path", return_value=mcp_config), \
         patch("openclaw_gnomon.cli.gnomon_config_path", return_value=gnomon_config):

        result = runner.invoke(app, ["install"])

    assert result.exit_code == 0
    assert (skills_dir / "gnomon" / "SKILL.md").exists()

    with open(mcp_config) as f:
        config = json.load(f)
    assert "gnomon" in config["mcpServers"]

    assert gnomon_config.exists()
