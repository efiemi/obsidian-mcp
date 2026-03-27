---
name: obsidian-get-note-links
description: Returns incoming and outgoing links with get_note_links. Use when validating bidirectional connectivity around a note.
license: Proprietary - Efiemi internal use
compatibility: Designed for agents that can call the Obsidian MCP server tools in this repository.
metadata:
  owner: efiemi
  mcp-server: obsidian-mcp
  mcp-tool: get_note_links
---

# obsidian-get-note-links

## When to use
Use this skill when you need to analyze incoming and outgoing links for one note.

## Preconditions
1. Confirm the target path exists when required by the tool.
2. Prefer vault-relative paths used by the Obsidian MCP server.
3. Keep updates minimal and focused on user intent.

## Tool call
Use MCP tool: get_note_links

Arguments:
~~~json
{"path":"Projetos/Devops/README.md"}
~~~

## Example
~~~json
{"name":"get_note_links","arguments":{"path":"Projetos/Devops/README.md"}}
~~~

## Guardrails
1. Do not use .. in paths.
2. Do not overwrite unrelated content.
3. Prefer read-first, then write/update.
