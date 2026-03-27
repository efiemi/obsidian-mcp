---
name: obsidian-get-note-metadata
description: Retrieves note metadata with get_note_metadata. Use for tags, size, created date, and backlink snapshot without reading entire content.
license: Proprietary - Efiemi internal use
compatibility: Designed for agents that can call the Obsidian MCP server tools in this repository.
metadata:
  owner: efiemi
  mcp-server: obsidian-mcp
  mcp-tool: get_note_metadata
---

# obsidian-get-note-metadata

## When to use
Use this skill when you need to inspect metadata of one note.

## Preconditions
1. Confirm the target path exists when required by the tool.
2. Prefer vault-relative paths used by the Obsidian MCP server.
3. Keep updates minimal and focused on user intent.

## Tool call
Use MCP tool: get_note_metadata

Arguments:
~~~json
{"path":"Projetos/Promotions Manager API/README.md"}
~~~

## Example
~~~json
{"name":"get_note_metadata","arguments":{"path":"Projetos/Promotions Manager API/README.md"}}
~~~

## Guardrails
1. Do not use .. in paths.
2. Do not overwrite unrelated content.
3. Prefer read-first, then write/update.
