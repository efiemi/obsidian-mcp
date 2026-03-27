---
name: obsidian-write-note
description: Writes or overwrites a note in the Obsidian vault using write_note. Use when replacing full note content is explicitly required.
license: Proprietary - Efiemi internal use
compatibility: Designed for agents that can call the Obsidian MCP server tools in this repository.
metadata:
  owner: efiemi
  mcp-server: obsidian-mcp
  mcp-tool: write_note
---

# obsidian-write-note

## When to use
Use this skill when you need to write full note content to a path.

## Preconditions
1. Confirm the target path exists when required by the tool.
2. Prefer vault-relative paths used by the Obsidian MCP server.
3. Keep updates minimal and focused on user intent.

## Tool call
Use MCP tool: write_note

Arguments:
~~~json
{"path":"Projetos/MCP-Obsidian/README.md","content":"# MCP-Obsidian\n..."}
~~~

## Example
~~~json
{"name":"write_note","arguments":{"path":"Projetos/MCP-Obsidian/README.md","content":"# MCP-Obsidian\n..."}}
~~~

## Guardrails
1. Do not use .. in paths.
2. Do not overwrite unrelated content.
3. Prefer read-first, then write/update.
