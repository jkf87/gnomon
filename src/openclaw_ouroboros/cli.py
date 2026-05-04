import typer
from pathlib import Path
import sys
from openclaw_ouroboros.paths import (
    openclaw_skills_dir,
    openclaw_mcp_config_path,
    ouroboros_config_path,
)
from openclaw_ouroboros.installer import (
    stage_skill_files,
    merge_mcp_entry,
    write_ouroboros_config,
    remove_mcp_entry,
)
from rich.console import Console

console = Console()
app = typer.Typer(help="Ouroboros for OpenClaw")


@app.command()
def install(verbose: bool = typer.Option(False, "--verbose", "-v")):
    """Install Ouroboros skill and MCP into OpenClaw. Idempotent."""
    try:
        skills_dir = openclaw_skills_dir()
        mcp_config_path = openclaw_mcp_config_path()
        config_path = ouroboros_config_path()
        
        console.print("[bold]Installing Ouroboros for OpenClaw...[/bold]")
        
        if verbose:
            console.print(f"  Staging skill files to {skills_dir}/ouroboros/")
        stage_skill_files(skills_dir)
        console.print("[green]✓[/green] Skill staged")
        
        if verbose:
            console.print(f"  Merging MCP entry in {mcp_config_path}")
        merge_mcp_entry(mcp_config_path)
        console.print("[green]✓[/green] MCP entry registered")
        
        if verbose:
            console.print(f"  Writing config to {config_path}")
        write_ouroboros_config(config_path)
        console.print("[green]✓[/green] Config written")
        
        console.print("\n[bold green]Installation complete![/bold green]")
        console.print("Run: /ouroboros:setup")
        
    except Exception as e:
        console.print(f"[red]✗ Installation failed: {e}[/red]", err=True)
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


@app.command()
def uninstall(verbose: bool = typer.Option(False, "--verbose", "-v")):
    """Uninstall Ouroboros from OpenClaw."""
    try:
        mcp_config_path = openclaw_mcp_config_path()
        console.print("[bold]Uninstalling Ouroboros from OpenClaw...[/bold]")
        
        if verbose:
            console.print(f"  Removing MCP entry from {mcp_config_path}")
        remove_mcp_entry(mcp_config_path)
        console.print("[green]✓[/green] MCP entry removed")
        
        console.print("[yellow]Note:[/yellow] ~/.openclaw/skills/ouroboros/ not deleted")
        console.print("\n[bold green]Uninstall complete![/bold green]")
        
    except Exception as e:
        console.print(f"[red]✗ Uninstall failed: {e}[/red]", err=True)
        sys.exit(1)


@app.command()
def doctor(verbose: bool = typer.Option(False, "--verbose", "-v")):
    """Diagnose Ouroboros installation."""
    try:
        console.print("[bold]Diagnosing Ouroboros installation...[/bold]")
        
        skills_dir = openclaw_skills_dir()
        mcp_config_path = openclaw_mcp_config_path()
        config_path = ouroboros_config_path()
        
        checks = []
        
        skill_file = skills_dir / "ouroboros" / "SKILL.md"
        skill_ok = skill_file.exists()
        checks.append(("Skill file", skill_ok, str(skill_file)))
        
        import json
        mcp_ok = False
        if mcp_config_path.exists():
            try:
                with open(mcp_config_path) as f:
                    config = json.load(f)
                mcp_ok = "ouroboros" in config.get("mcpServers", {})
            except:
                pass
        checks.append(("MCP entry", mcp_ok, str(mcp_config_path)))
        
        config_ok = config_path.exists()
        checks.append(("Ouroboros config", config_ok, str(config_path)))
        
        import subprocess
        try:
            subprocess.run(["uvx", "--version"], capture_output=True, check=True, timeout=5)
            uvx_ok = True
        except:
            uvx_ok = False
        checks.append(("uvx available", uvx_ok, "uvx on PATH"))
        
        console.print()
        for name, ok, path in checks:
            icon = "[green]✓[/green]" if ok else "[red]✗[/red]"
            console.print(f"{icon} {name}: {path}")
        
        all_ok = all(ok for _, ok, _ in checks)
        if all_ok:
            console.print("\n[bold green]All checks passed![/bold green]")
            sys.exit(0)
        else:
            console.print("\n[bold yellow]Some checks failed. Run: openclaw-ouroboros install[/bold yellow]")
            sys.exit(1)
        
    except Exception as e:
        console.print(f"[red]Doctor check failed: {e}[/red]", err=True)
        sys.exit(1)


if __name__ == "__main__":
    app()
