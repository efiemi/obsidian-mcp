---
name: obsidian-create-note-from-template
description: Creates notes from predefined templates via create_note_from_template. Use when generating structured docs like architecture, ADR, meeting, or decision logs.
license: Proprietary - Efiemi internal use
compatibility: Designed for agents that can call the Obsidian MCP server tools in this repository.
metadata:
  owner: efiemi
  mcp-server: obsidian-mcp
  mcp-tool: create_note_from_template
---

# obsidian-create-note-from-template

## When to use
Use this skill when you need to create a new structured note from a template.

## Preconditions
1. Confirm the target path exists when required by the tool.
2. Prefer vault-relative paths used by the Obsidian MCP server.
3. Keep updates minimal and focused on user intent.

## Tool call
Use MCP tool: create_note_from_template

Arguments:
~~~json
{"template":"adr","data":{"id":"001","title":"Persistir embeddings","status":"Accepted","date":"2026-03-25","context":"...","decision":"...","consequences":"...","alternatives":"..."},"path":"Projetos/MCP-Obsidian/ADRs/001-persistencia.md"}
~~~

## Example
~~~json
{"name":"create_note_from_template","arguments":{"template":"adr","data":{"id":"001","title":"Persistir embeddings","status":"Accepted","date":"2026-03-25","context":"...","decision":"...","consequences":"...","alternatives":"..."},"path":"Projetos/MCP-Obsidian/ADRs/001-persistencia.md"}}
~~~

## Guardrails
1. Do not use .. in paths.
2. Do not overwrite unrelated content.
3. Prefer read-first, then write/update.
