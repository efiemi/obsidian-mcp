---
name: obsidian-update-section
description: Updates or creates a specific markdown heading section using update_section. Use for targeted edits that should preserve the rest of the note.
license: Proprietary - Efiemi internal use
compatibility: Designed for agents that can call the Obsidian MCP server tools in this repository.
metadata:
  owner: efiemi
  mcp-server: obsidian-mcp
  mcp-tool: update_section
---

# obsidian-update-section

## When to use
Use this skill when you need to update exactly one heading section in a note.

## Preconditions
1. Confirm the target path exists when required by the tool.
2. Prefer vault-relative paths used by the Obsidian MCP server.
3. Keep updates minimal and focused on user intent.

## Tool call
Use MCP tool: update_section

Arguments:
~~~json
{"path":"Projetos/Devops/README.md","heading":"## Observacoes","content":"- Conteudo atualizado"}
~~~

## Example
~~~json
{"name":"update_section","arguments":{"path":"Projetos/Devops/README.md","heading":"## Observacoes","content":"- Conteudo atualizado"}}
~~~

## Guardrails
1. Do not use .. in paths.
2. Do not overwrite unrelated content.
3. Prefer read-first, then write/update.
