---
name: obsidian-read-note
description: Reads a note from the Obsidian vault using the read_note MCP tool. Use when you need the full current content of a specific note before analysis or edits.
license: Proprietary - Efiemi internal use
compatibility: Designed for agents that can call the Obsidian MCP server tools in this repository.
metadata:
  owner: efiemi
  mcp-server: obsidian-mcp
  mcp-tool: read_note
---

# obsidian-read-note

## When to use
Use this skill when you need to read a single note by path.

## Preconditions
1. Confirm the target path exists when required by the tool.
2. Prefer vault-relative paths used by the Obsidian MCP server.
3. Keep updates minimal and focused on user intent.

## Tool call
Use MCP tool: read_note

Arguments:
~~~json
{"path":"Projetos/Devops/README.md"}
~~~

## Example
~~~json
{"name":"read_note","arguments":{"path":"Projetos/Devops/README.md"}}
~~~

## Guardrails
1. Do not use .. in paths.
2. Do not overwrite unrelated content.
3. Prefer read-first, then write/update.
