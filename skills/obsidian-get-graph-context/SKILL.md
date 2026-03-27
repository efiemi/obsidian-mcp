---
name: obsidian-get-graph-context
description: Builds local graph context and semantic cluster using get_graph_context. Use when preparing multi-note context for complex cross-project tasks.
license: Proprietary - Efiemi internal use
compatibility: Designed for agents that can call the Obsidian MCP server tools in this repository.
metadata:
  owner: efiemi
  mcp-server: obsidian-mcp
  mcp-tool: get_graph_context
---

# obsidian-get-graph-context

## When to use
Use this skill when you need to retrieve related notes and cluster for a focal note.

## Preconditions
1. Confirm the target path exists when required by the tool.
2. Prefer vault-relative paths used by the Obsidian MCP server.
3. Keep updates minimal and focused on user intent.

## Tool call
Use MCP tool: get_graph_context

Arguments:
~~~json
{"path":"Projetos/Devops/README.md","topK":8}
~~~

## Example
~~~json
{"name":"get_graph_context","arguments":{"path":"Projetos/Devops/README.md","topK":8}}
~~~

## Guardrails
1. Do not use .. in paths.
2. Do not overwrite unrelated content.
3. Prefer read-first, then write/update.
