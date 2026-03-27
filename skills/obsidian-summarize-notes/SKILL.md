---
name: obsidian-summarize-notes
description: Summarizes multiple notes with summarize_notes. Use to compress large context before planning edits or implementations.
license: Proprietary - Efiemi internal use
compatibility: Designed for agents that can call the Obsidian MCP server tools in this repository.
metadata:
  owner: efiemi
  mcp-server: obsidian-mcp
  mcp-tool: summarize_notes
---

# obsidian-summarize-notes

## When to use
Use this skill when you need to produce compact summaries of a note set.

## Preconditions
1. Confirm the target path exists when required by the tool.
2. Prefer vault-relative paths used by the Obsidian MCP server.
3. Keep updates minimal and focused on user intent.

## Tool call
Use MCP tool: summarize_notes

Arguments:
~~~json
{"paths":["Projetos/Devops/README.md","Projetos/Promotions Manager API/README.md","Projetos/Promotions Manager User UI/README.md"]}
~~~

## Example
~~~json
{"name":"summarize_notes","arguments":{"paths":["Projetos/Devops/README.md","Projetos/Promotions Manager API/README.md","Projetos/Promotions Manager User UI/README.md"]}}
~~~

## Guardrails
1. Do not use .. in paths.
2. Do not overwrite unrelated content.
3. Prefer read-first, then write/update.
