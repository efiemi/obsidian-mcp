# Obsidian MCP Server (Node.js)

Servidor MCP em Node.js/TypeScript para integrar agentes (Codex/IDE) com um vault do Obsidian via REST API.

## Funcionalidades

- `read_note`: lê uma nota
- `write_note`: cria/sobrescreve uma nota
- `append_to_note`: adiciona conteúdo ao final sem overwrite
- `create_folder`: cria pasta garantindo um `README.md` vazio
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
- `get_index_status`: status de saúde/cobertura do índice vetorial
- `run_ingest`: dispara ingestão usando a versão do Node definida em `.nvmrc`
- `mark_dirty`: marca índice incremental como sujo
- `sync_if_dirty`: sincroniza incrementalmente apenas quando houver dirty flag
- `sync_files`: sincroniza incrementalmente uma lista de paths
- `reset_sync_state`: reseta estado local de sync incremental

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
VECTOR_DB_URL=postgresql://obsidian:obsidian@localhost:5433/obsidian_mcp
EMBEDDING_PROVIDER=bedrock
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=amazon.titan-embed-text-v2:0
BEDROCK_EMBEDDING_DIMENSIONS=256
BEDROCK_MAX_INPUT_CHARS=25000
HYBRID_KEYWORD_WEIGHT=0.45
HYBRID_SEMANTIC_WEIGHT=0.55
AWS_BEARER_TOKEN_BEDROCK=your_bedrock_bearer_token_here
```

Observação:
- Se `EMBEDDING_PROVIDER` não for `bedrock`, o projeto usa embedding determinístico local (fallback) para desenvolvimento.
- Se `VECTOR_DB_URL` estiver definido, o servidor usa Postgres/pgvector como store vetorial persistente.
- Se `VECTOR_DB_URL` estiver vazio, o servidor usa fallback em memória.

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
- `npm run ingest` agora usa `nvm use` automaticamente (via `.nvmrc`) antes de executar a ingestão.

Observação:
- `OBSIDIAN_VAULT_ROOT` pode ser caminho absoluto (recomendado) ou apenas o nome do vault (ex.: `Efiemi-Tech`).
- Quando for apenas nome, o script tenta localizar em `./`, `~/`, `~/Obsidian`, `~/Documents/Obsidian` e `~/Documentos/Obsidian`.
- Se houver notas muito grandes, ajuste `BEDROCK_MAX_INPUT_CHARS` para limitar o texto enviado ao modelo de embedding e evitar `HTTP 400` de validação.

## Quando o RAG é usado neste servidor

O servidor usa RAG nas tools abaixo:

- `semantic_search`: faz embedding da query e busca vetorial no `VectorStore` (Postgres/pgvector ou memória). Para ter resultado consistente aqui, rode `npm run ingest` antes.
- `hybrid_search`: combina busca keyword (`search_notes`) com score semântico.
  - Primeiro tenta semântico no índice vetorial.
  - Se o índice estiver vazio/incompleto, faz fallback "live" lendo notas do vault (até 120) e calculando embedding na hora.
- `get_similar_notes`: calcula embedding da nota alvo e procura similares no índice vetorial.
  - Se faltar cobertura no índice, também usa fallback "live" no vault.

Tools como `read_note`, `list_notes`, `search_notes` e `summarize_notes` não dependem de índice vetorial para funcionar.

## Operação de índice

- `get_index_status`: retorna total de notas markdown, total indexado, cobertura percentual, `lastIndexedAt`, provider de embedding e backend vetorial.
- `run_ingest`: permite disparar ingestão pelo próprio agente MCP; retorna `stdout/stderr` do comando.
- `mark_dirty`: define dirty flag no arquivo `.obsidian-mcp/index-state.json`.
- `sync_if_dirty`: processa apenas arquivos alterados desde a última sync com base em hash persistido.
- `sync_files`: recebe paths relativos ao root do vault e sincroniza apenas esses arquivos.
- `reset_sync_state`: limpa o estado incremental local para reinicialização do processo.

## Quando usamos embedding via Bedrock

O Bedrock é usado sempre que `EMBEDDING_PROVIDER=bedrock`:

- Durante `npm run ingest`: embedding de cada nota indexada.
- Durante consultas semânticas: embedding da query em `semantic_search` e `hybrid_search`.
- Em `get_similar_notes`: embedding da nota alvo e, no fallback "live", embedding das notas candidatas.

Se `EMBEDDING_PROVIDER` for diferente de `bedrock`, o servidor usa embedding determinístico local (hash), útil para dev/testes, mas com qualidade semântica inferior.

## Por que usar este servidor MCP vs ler `.md` direto no agente

Principais vantagens do servidor:

- Menor custo de contexto: retorna poucos candidatos relevantes em vez de enviar muitas notas completas ao agente.
- Melhor recall semântico: encontra notas relacionadas mesmo sem correspondência literal de palavra-chave.
- Escalabilidade: índice vetorial (pgvector) mantém busca rápida com volume maior de notas.
- Repetibilidade: mesma query tende a retornar ranking estável (menos dependente da janela de contexto do agente).
- Integração operacional: tools especializadas (`hybrid_search`, `get_similar_notes`, `get_graph_context`) reduzem prompt/manual work.

Trade-off importante:

- Qualidade depende de ingestão atualizada. Se o vault mudou e não houve `ingest`, parte dos resultados pode depender do fallback "live" (mais lento e limitado).

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
