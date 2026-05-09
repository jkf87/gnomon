import os
import pytest
from pathlib import Path
from unittest.mock import patch
from openclaw_gnomon.paths import (
    openclaw_skills_dir,
    openclaw_mcp_config_path,
    gnomon_config_path,
)

def test_openclaw_skills_dir_default(tmp_path):
    """Default: ~/.openclaw/skills"""
    with patch.dict(os.environ, {"HOME": str(tmp_path)}):
        result = openclaw_skills_dir()
        assert result == tmp_path / ".openclaw" / "skills"

def test_openclaw_skills_dir_env_override(tmp_path):
    """OPENCLAW_SKILLS_DIR env var overrides"""
    custom = tmp_path / "custom_skills"
    with patch.dict(os.environ, {"OPENCLAW_SKILLS_DIR": str(custom)}):
        result = openclaw_skills_dir()
        assert result == custom

def test_openclaw_mcp_config_path_default(tmp_path):
    """Default: ~/.openclaw/mcp/claude-mcp-config.json"""
    with patch.dict(os.environ, {"HOME": str(tmp_path)}):
        result = openclaw_mcp_config_path()
        assert result == tmp_path / ".openclaw" / "mcp" / "claude-mcp-config.json"

def test_openclaw_mcp_config_path_env_override(tmp_path):
    """OPENCLAW_MCP_CONFIG env var overrides"""
    custom = tmp_path / "custom_mcp.json"
    with patch.dict(os.environ, {"OPENCLAW_MCP_CONFIG": str(custom)}):
        result = openclaw_mcp_config_path()
        assert result == custom

def test_gnomon_config_path_default(tmp_path):
    """Default: ~/.gnomon/config.yaml"""
    with patch.dict(os.environ, {"HOME": str(tmp_path)}):
        result = gnomon_config_path()
        assert result == tmp_path / ".gnomon" / "config.yaml"

def test_gnomon_config_path_env_override(tmp_path):
    """GNOMON_CONFIG env var overrides"""
    custom = tmp_path / "custom_config.yaml"
    with patch.dict(os.environ, {"GNOMON_CONFIG": str(custom)}):
        result = gnomon_config_path()
        assert result == custom
