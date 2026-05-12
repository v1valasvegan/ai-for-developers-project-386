# Render MCP setup for OpenCode

This project uses Render MCP through OpenCode.

## 1) OpenCode config

File: `~/.config/opencode/opencode.json`

Ensure the `mcp.render` section exists:

```json
"render": {
  "type": "remote",
  "url": "https://mcp.render.com/mcp",
  "enabled": true,
  "headers": {
    "Authorization": "Bearer ${env:RENDER_API_KEY}"
  }
}
```

## 2) Export API key in shell

Set env var in current terminal:

```bash
read -r "RENDER_API_KEY?Paste Render API key and press Enter: "
export RENDER_API_KEY
```

Persist it for future zsh sessions:

```bash
printf '\n# Render MCP\nexport RENDER_API_KEY="%s"\n' "$RENDER_API_KEY" >> ~/.zshrc
source ~/.zshrc
```

## 3) Restart OpenCode

OpenCode must be restarted to pick up new environment variables.

## 4) Verify MCP works

In OpenCode chat:

1. `Set my Render workspace to <WORKSPACE_NAME>`
2. `List my Render services`

## Troubleshooting

- `RENDER_API_KEY` is empty:
  - Run `echo "len=${#RENDER_API_KEY}"` and confirm length is not zero.
- Unauthorized/forbidden errors:
  - Regenerate Render API key and update `RENDER_API_KEY`.
- Workspace prompt fails:
  - Confirm exact workspace name in Render dashboard.
