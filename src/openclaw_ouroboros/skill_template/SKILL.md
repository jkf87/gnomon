---
name: ouroboros
description: "Spec-first workflow engine. Interview → seed → run → evolve. Wraps ouroboros-ai CLI/MCP inside OpenClaw."
---

# /ouroboros

Ouroboros workflows from OpenClaw. Uses `ouroboros-ai[mcp]` runtime.

## Usage

### `/ouroboros:setup`
Initialize or repair Ouroboros in OpenClaw. Runs idempotent install, warms uvx cache, diagnoses issues.
**Example:** `/ouroboros:setup`

### `/ouroboros:interview`
Start spec-first workflow. Ouroboros interviews you → generates seed.yaml → ready for run.
**Example:** `/ouroboros:interview "rebuild the auth module to use JWT"`

### `/ouroboros:run`
Execute a workflow from a seed.yaml file.
**Example:** `/ouroboros:run (provide seed.yaml path or paste YAML)`

### `/ouroboros:status`
Check execution status and logs.
**Example:** `/ouroboros:status <execution_id>`

### `/ouroboros:cancel`
Stop a running workflow.
**Example:** `/ouroboros:cancel <execution_id>`

---

## Troubleshooting

- **"ouroboros: command not found"** — Run `/ouroboros:setup` to install.
- **"OpenClaw CLI not found"** — Ensure `openclaw` is on your PATH.
- **MCP errors** — Restart your OpenClaw agent or start a new session.

## Links
- [Ouroboros repo](https://github.com/jkf87/ouroboros)
- [Design spec](https://github.com/jkf87/openclaw-ouroboros/blob/main/docs/design.md)
