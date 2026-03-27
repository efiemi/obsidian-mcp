---
name: obsidian-list-folders
description: Lists folders recursively with list_folders. Use when planning organization or selecting where to create a new note.
license: Proprietary - Efiemi internal use
compatibility: Designed for agents that can call the Obsidian MCP server tools in this repository.
metadata:
  owner: efiemi
  mcp-server: obsidian-mcp
  mcp-tool: list_folders
---

# obsidian-list-folders

## When to use
Use this skill when you need to discover folder hierarchy.

## Preconditions
1. Confirm the target path exists when required by the tool.
2. Prefer vault-relative paths used by the Obsidian MCP server.
3. Keep updates minimal and focused on user intent.

## Tool call
Use MCP tool: list_folders

Arguments:
~~~json
{"path":"Projetos"}
~~~

## Example
~~~json
{"name":"list_folders","arguments":{"path":"Projetos"}}
~~~

## Guardrails
1. Do not use .. in paths.
2. Do not overwrite unrelated content.
3. Prefer read-first, then write/update.
