---
name: obsidian-list-notes
description: Lists markdown files recursively with list_notes. Use when you need to discover available notes before reading or linking them.
license: Proprietary - Efiemi internal use
compatibility: Designed for agents that can call the Obsidian MCP server tools in this repository.
metadata:
  owner: efiemi
  mcp-server: obsidian-mcp
  mcp-tool: list_notes
---

# obsidian-list-notes

## When to use
Use this skill when you need to list note paths under the vault or a folder.

## Preconditions
1. Confirm the target path exists when required by the tool.
2. Prefer vault-relative paths used by the Obsidian MCP server.
3. Keep updates minimal and focused on user intent.

## Tool call
Use MCP tool: list_notes

Arguments:
~~~json
{"path":"Projetos/Devops"}
~~~

## Example
~~~json
{"name":"list_notes","arguments":{"path":"Projetos/Devops"}}
~~~

## Guardrails
1. Do not use .. in paths.
2. Do not overwrite unrelated content.
3. Prefer read-first, then write/update.
