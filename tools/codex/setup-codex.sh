#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
SKILLS_HOME="$CODEX_HOME/skills"
CONFIG_FILE="$CODEX_HOME/config.toml"

REPO_SKILL_DIR="$REPO_ROOT/tools/codex/skills/gcp-backend"
INSTALLED_SKILL_DIR="$SKILLS_HOME/gcp-backend"

MCP_NAME="${CODEX_MCP_NAME:-repo_workspace}"
MCP_COMMAND="${CODEX_MCP_COMMAND:-node}"
MCP_ARGS_DEFAULT='["'"$REPO_ROOT"'/tools/codex/mcp/index.js"]'
MCP_ARGS="${CODEX_MCP_ARGS:-$MCP_ARGS_DEFAULT}"

ensure_dir() {
  mkdir -p "$1"
}

install_skill() {
  ensure_dir "$SKILLS_HOME"

  if command -v ln >/dev/null 2>&1; then
    rm -rf "$INSTALLED_SKILL_DIR"
    ln -s "$REPO_SKILL_DIR" "$INSTALLED_SKILL_DIR"
    printf 'Linked skill: %s -> %s\n' "$INSTALLED_SKILL_DIR" "$REPO_SKILL_DIR"
    return
  fi

  rm -rf "$INSTALLED_SKILL_DIR"
  cp -R "$REPO_SKILL_DIR" "$INSTALLED_SKILL_DIR"
  printf 'Copied skill: %s -> %s\n' "$REPO_SKILL_DIR" "$INSTALLED_SKILL_DIR"
}

ensure_config_file() {
  ensure_dir "$CODEX_HOME"
  if [ ! -f "$CONFIG_FILE" ]; then
    : > "$CONFIG_FILE"
  fi
}

append_mcp_config() {
  ensure_config_file

  if grep -F "[mcp_servers.$MCP_NAME]" "$CONFIG_FILE" >/dev/null 2>&1; then
    printf 'MCP entry already exists in %s: %s\n' "$CONFIG_FILE" "$MCP_NAME"
    return
  fi

  {
    printf '\n[mcp_servers.%s]\n' "$MCP_NAME"
    printf 'command = "%s"\n' "$MCP_COMMAND"
    printf 'args = %s\n' "$MCP_ARGS"
  } >> "$CONFIG_FILE"

  printf 'Added MCP entry to %s: %s\n' "$CONFIG_FILE" "$MCP_NAME"
}

print_next_steps() {
  cat <<EOF
Codex repo bootstrap completed.

Installed skill:
- $INSTALLED_SKILL_DIR

Updated config:
- $CONFIG_FILE

Notes:
- If your MCP server entry point differs, set CODEX_MCP_COMMAND and CODEX_MCP_ARGS before running this script.
- Default MCP path points to: $REPO_ROOT/tools/codex/mcp/index.js
- If that server does not exist yet, the config entry is still added as a placeholder for the team.
EOF
}

install_skill
append_mcp_config
print_next_steps
