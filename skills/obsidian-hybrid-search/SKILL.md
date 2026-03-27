---
name: obsidian-hybrid-search
description: Combines keyword and semantic ranking via hybrid_search. Use as default retrieval for high-recall context gathering across projects.
license: Proprietary - Efiemi internal use
compatibility: Designed for agents that can call the Obsidian MCP server tools in this repository.
metadata:
  owner: efiemi
  mcp-server: obsidian-mcp
  mcp-tool: hybrid_search
---

# obsidian-hybrid-search

## When to use
Use this skill when you need to retrieve best notes with mixed lexical and semantic scoring.

## Preconditions
1. Confirm the target path exists when required by the tool.
2. Prefer vault-relative paths used by the Obsidian MCP server.
3. Keep updates minimal and focused on user intent.

## Tool call
Use MCP tool: hybrid_search

Arguments:
~~~json
{"query":"contracts promotions statistics","topK":10}
~~~

## Example
~~~json
{"name":"hybrid_search","arguments":{"query":"contracts promotions statistics","topK":10}}
~~~

## Guardrails
1. Do not use .. in paths.
2. Do not overwrite unrelated content.
3. Prefer read-first, then write/update.
