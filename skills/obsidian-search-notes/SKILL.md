---
name: obsidian-search-notes
description: Searches notes by keyword with search_notes. Use when exact terms, identifiers, or endpoint names are known.
license: Proprietary - Efiemi internal use
compatibility: Designed for agents that can call the Obsidian MCP server tools in this repository.
metadata:
  owner: efiemi
  mcp-server: obsidian-mcp
  mcp-tool: search_notes
---

# obsidian-search-notes

## When to use
Use this skill when you need to find notes by keyword and lexical relevance.

## Preconditions
1. Confirm the target path exists when required by the tool.
2. Prefer vault-relative paths used by the Obsidian MCP server.
3. Keep updates minimal and focused on user intent.

## Tool call
Use MCP tool: search_notes

Arguments:
~~~json
{"query":"app_runner_api"}
~~~

## Example
~~~json
{"name":"search_notes","arguments":{"query":"app_runner_api"}}
~~~

## Guardrails
1. Do not use .. in paths.
2. Do not overwrite unrelated content.
3. Prefer read-first, then write/update.
