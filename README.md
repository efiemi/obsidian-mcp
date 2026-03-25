# Obsidian MCP Server (Node.js)

Servidor MCP em Node.js/TypeScript para integrar agentes (Codex/IDE) com um vault do Obsidian via REST API.

## Funcionalidades

- `read_note`: lê uma nota
- `write_note`: cria/sobrescreve uma nota
- `append_to_note`: adiciona conteúdo ao final sem overwrite
- `update_section`: atualiza/cria seção markdown por heading
- `create_note_from_template`: cria nota a partir de template + dados
- `search_notes`: busca textual
- `list_notes`: lista notas `.md` (recursivo)
- `list_folders`: lista pastas (recursivo)
- `get_note_metadata`: metadados da nota (tamanho, tags, criação, backlinks)
- `get_note_links`: links de saída e entrada de uma nota
- `get_backlinks`: notas que referenciam a nota alvo
- `get_outgoing_links`: links presentes na nota alvo
- `get_graph_context`: notas relacionadas e cluster semântico
- `semantic_search`: busca semântica (RAG)
- `hybrid_search`: combina ranking keyword + semântico
- `get_similar_notes`: encontra notas semanticamente similares
- `summarize_notes`: resume notas para preparação de contexto

Templates disponíveis em `create_note_from_template`:
- `architecture`
- `adr`
- `meeting`
- `decision-log`

## Requisitos

- Node.js 20+
- npm 10+
- Obsidian Local REST API habilitada

## Instalação

```bash
npm install
```

## Configuração

1. Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

2. Ajuste as variáveis principais em `.env`:

```env
OBSIDIAN_BASE_URL=https://localhost:27124
OBSIDIAN_API_KEY=your_key_here
OBSIDIAN_VAULT_ROOT=AI Engineering
EMBEDDING_PROVIDER=bedrock
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=amazon.titan-embed-text-v2:0
BEDROCK_EMBEDDING_DIMENSIONS=256
AWS_BEARER_TOKEN_BEDROCK=your_bedrock_bearer_token_here
```

Observação:
- Se `EMBEDDING_PROVIDER` não for `bedrock`, o projeto usa embedding determinístico local (fallback) para desenvolvimento.

## Desenvolvimento

Rodar servidor MCP em modo dev (stdio):

```bash
npm run dev:mcp
```

Observação:
- O script `dev:mcp` faz `build` e inicia com `node dist/...` para evitar problemas de IPC do `tsx` em alguns ambientes.

Build de produção:

```bash
npm run build
```

Rodar build compilado:

```bash
npm run start:mcp
```

## Ingestão de Vault (RAG)

Indexa todos os `.md` da pasta configurada em `OBSIDIAN_VAULT_ROOT`:

```bash
npm run ingest
```

Observação:
- `OBSIDIAN_VAULT_ROOT` pode ser caminho absoluto (recomendado) ou apenas o nome do vault (ex.: `Efiemi-Tech`).
- Quando for apenas nome, o script tenta localizar em `./`, `~/`, `~/Obsidian`, `~/Documents/Obsidian` e `~/Documentos/Obsidian`.

## Integração MCP (Codex/IDE)

O arquivo `mcp-servers.json` já está configurado para iniciar este servidor:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": ["dist/src/mcp_stdio.js"],
      "cwd": "/home/bruno/Documentos/Projetos/efiemi/obsidian-mcp"
    }
  }
}
```

Importante:
- Rode `npm run build` antes de conectar o cliente MCP.
- Evite iniciar via `npm run ...` no `mcp-servers.json`, porque logs do `npm` no `stdout` podem quebrar o handshake MCP.

## Estrutura

```text
src/
  config.ts
  mcp/
    server.ts
    schemas.ts
    tools/
  obsidian/
    client.ts
  rag/
    embedder.ts
    indexer.ts
    vector-store.ts
scripts/
  ingest-vault.ts
```

## Guia de referência

As diretrizes originais do projeto estão em `GUIA.md`.
