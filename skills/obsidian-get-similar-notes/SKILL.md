---
name: obsidian-get-similar-notes
description: Finds semantically similar notes from a source note using get_similar_notes. Use when expanding context from one trusted anchor document.
license: Proprietary - Efiemi internal use
compatibility: Designed for agents that can call the Obsidian MCP server tools in this repository.
metadata:
  owner: efiemi
  mcp-server: obsidian-mcp
  mcp-tool: get_similar_notes
---

# obsidian-get-similar-notes

## When to use
Use this skill when you need to discover notes close in meaning to a given note.

## Preconditions
1. Confirm the target path exists when required by the tool.
2. Prefer vault-relative paths used by the Obsidian MCP server.
3. Keep updates minimal and focused on user intent.

## Tool call
Use MCP tool: get_similar_notes

Arguments:
~~~json
{"path":"Projetos/Promotions Manager API/README.md","topK":6}
~~~

## Example
~~~json
{"name":"get_similar_notes","arguments":{"path":"Projetos/Promotions Manager API/README.md","topK":6}}
~~~

## Guardrails
1. Do not use .. in paths.
2. Do not overwrite unrelated content.
3. Prefer read-first, then write/update.
