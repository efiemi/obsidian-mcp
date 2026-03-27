---
name: obsidian-append-to-note
description: Appends content to an existing note with append_to_note. Use when you need to add information without changing prior sections.
license: Proprietary - Efiemi internal use
compatibility: Designed for agents that can call the Obsidian MCP server tools in this repository.
metadata:
  owner: efiemi
  mcp-server: obsidian-mcp
  mcp-tool: append_to_note
---

# obsidian-append-to-note

## When to use
Use this skill when you need to append new content at the end of a note.

## Preconditions
1. Confirm the target path exists when required by the tool.
2. Prefer vault-relative paths used by the Obsidian MCP server.
3. Keep updates minimal and focused on user intent.

## Tool call
Use MCP tool: append_to_note

Arguments:
~~~json
{"path":"Projetos/Devops/README.md","content":"\n## Novas Observacoes\n- Item"}
~~~

## Example
~~~json
{"name":"append_to_note","arguments":{"path":"Projetos/Devops/README.md","content":"\n## Novas Observacoes\n- Item"}}
~~~

## Guardrails
1. Do not use .. in paths.
2. Do not overwrite unrelated content.
3. Prefer read-first, then write/update.
