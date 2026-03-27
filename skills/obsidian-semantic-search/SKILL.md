---
name: obsidian-semantic-search
description: Runs embedding-based retrieval with semantic_search. Use when the user intent is conceptual and exact keywords may be unknown.
license: Proprietary - Efiemi internal use
compatibility: Designed for agents that can call the Obsidian MCP server tools in this repository.
metadata:
  owner: efiemi
  mcp-server: obsidian-mcp
  mcp-tool: semantic_search
---

# obsidian-semantic-search

## When to use
Use this skill when you need to search semantically similar notes by natural language query.

## Preconditions
1. Confirm the target path exists when required by the tool.
2. Prefer vault-relative paths used by the Obsidian MCP server.
3. Keep updates minimal and focused on user intent.

## Tool call
Use MCP tool: semantic_search

Arguments:
~~~json
{"query":"como o deploy da API e do frontend se conectam"}
~~~

## Example
~~~json
{"name":"semantic_search","arguments":{"query":"como o deploy da API e do frontend se conectam"}}
~~~

## Guardrails
1. Do not use .. in paths.
2. Do not overwrite unrelated content.
3. Prefer read-first, then write/update.
