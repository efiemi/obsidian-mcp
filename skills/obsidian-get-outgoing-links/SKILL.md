---
name: obsidian-get-outgoing-links
description: Extracts outgoing links from a note with get_outgoing_links. Use when auditing dependency references inside a document.
license: Proprietary - Efiemi internal use
compatibility: Designed for agents that can call the Obsidian MCP server tools in this repository.
metadata:
  owner: efiemi
  mcp-server: obsidian-mcp
  mcp-tool: get_outgoing_links
---

# obsidian-get-outgoing-links

## When to use
Use this skill when you need to list links contained in one note.

## Preconditions
1. Confirm the target path exists when required by the tool.
2. Prefer vault-relative paths used by the Obsidian MCP server.
3. Keep updates minimal and focused on user intent.

## Tool call
Use MCP tool: get_outgoing_links

Arguments:
~~~json
{"path":"Projetos/Promotions Manager User UI/README.md"}
~~~

## Example
~~~json
{"name":"get_outgoing_links","arguments":{"path":"Projetos/Promotions Manager User UI/README.md"}}
~~~

## Guardrails
1. Do not use .. in paths.
2. Do not overwrite unrelated content.
3. Prefer read-first, then write/update.
