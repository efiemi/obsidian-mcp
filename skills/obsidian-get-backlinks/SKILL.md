---
name: obsidian-get-backlinks
description: Retrieves backlinks with get_backlinks. Use when you need to see which notes reference a specific target.
license: Proprietary - Efiemi internal use
compatibility: Designed for agents that can call the Obsidian MCP server tools in this repository.
metadata:
  owner: efiemi
  mcp-server: obsidian-mcp
  mcp-tool: get_backlinks
---

# obsidian-get-backlinks

## When to use
Use this skill when you need to find notes that reference a given note.

## Preconditions
1. Confirm the target path exists when required by the tool.
2. Prefer vault-relative paths used by the Obsidian MCP server.
3. Keep updates minimal and focused on user intent.

## Tool call
Use MCP tool: get_backlinks

Arguments:
~~~json
{"path":"Projetos/MCP-Obsidian/README.md"}
~~~

## Example
~~~json
{"name":"get_backlinks","arguments":{"path":"Projetos/MCP-Obsidian/README.md"}}
~~~

## Guardrails
1. Do not use .. in paths.
2. Do not overwrite unrelated content.
3. Prefer read-first, then write/update.
