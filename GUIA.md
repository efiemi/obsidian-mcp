# 📦 Obsidian MCP Server (Python) — Guia de Implementação

## 🎯 Objetivo

Construir um **MCP Server em Python** que permita que agentes (Codex CLI / IDE) interajam com um vault do Obsidian via REST API, incluindo:

* Leitura e escrita de notas
* Busca de notas
* Busca semântica (RAG)

---

## 🧠 Contexto Técnico

O MCP (Model Context Protocol):

* Usa **JSON-RPC 2.0** como base ([JSON-RPC Tools][1])
* Permite expor **tools que o modelo descobre e executa automaticamente** ([Model Context Protocol][2])
* Fluxo principal:

  * `initialize`
  * `tools/list`
  * `tools/call` ([JSON-RPC Tools][1])

---

## 🏗️ Arquitetura

```
Codex CLI / IDE (MCP Client)
        ↓
MCP Server (Python)
        ↓
Obsidian Local REST API
        ↓
Vault (.md)

        +
        
Embedding + Vector DB (RAG)
```

---

## 📁 Estrutura do Projeto

```
obsidian-mcp/
├── app/
│   ├── mcp/
│   │   ├── server.py
│   │   ├── tools/
│   │   │   ├── notes.py
│   │   │   ├── search.py
│   │   │   └── rag.py
│   │   └── schemas.py
│   │
│   ├── obsidian/
│   │   ├── client.py
│   │   └── models.py
│   │
│   ├── rag/
│   │   ├── embedder.py
│   │   ├── indexer.py
│   │   └── vector_store.py
│   │
│   └── config.py
│
├── scripts/
│   └── ingest_vault.py
│
├── main.py
├── requirements.txt
└── .env
```

---

## 🔌 Configuração Inicial

### Variáveis de ambiente

```
OBSIDIAN_BASE_URL=https://localhost:27124
OBSIDIAN_API_KEY=your_key_here
VECTOR_DB_URL=postgresql://...
EMBEDDING_PROVIDER=openai|bedrock|local
```

---

## 🧱 Camada 1 — Obsidian Client

Responsável por encapsular chamadas HTTP.

### Requisitos:

* Usar `httpx`
* Suportar HTTPS self-signed
* Incluir API Key no header

### Funções obrigatórias:

* `read_note(path: str) -> str`
* `write_note(path: str, content: str)`
* `list_notes()`
* `search_notes(query: str)`

---

## 🧠 Camada 2 — MCP Server

### Requisitos obrigatórios:

Implementar JSON-RPC com:

* `initialize`
* `tools/list`
* `tools/call`

### Tools obrigatórias:

#### 1. read_note

```json
{
  "name": "read_note",
  "description": "Read a note from Obsidian vault",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string" }
    },
    "required": ["path"]
  }
}
```

---

#### 2. write_note

```json
{
  "name": "write_note",
  "description": "Write or overwrite a note",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string" },
      "content": { "type": "string" }
    },
    "required": ["path", "content"]
  }
}
```

---

#### 3. search_notes

```json
{
  "name": "search_notes",
  "description": "Search notes by keyword",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string" }
    },
    "required": ["query"]
  }
}
```

---

#### 4. semantic_search (RAG)

```json
{
  "name": "semantic_search",
  "description": "Semantic search across notes using embeddings",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string" }
    },
    "required": ["query"]
  }
}
```

---

## 🔎 Camada 3 — RAG (Retrieval Augmented Generation)

### Requisitos:

* Gerar embeddings para cada nota
* Armazenar em banco vetorial
* Permitir busca por similaridade

---

### Estratégia de chunking

Dividir notas por:

* `## headings`
* ou blocos de 500–1000 tokens

---

### Estrutura do documento indexado

```json
{
  "path": "architecture/auth.md",
  "content": "...",
  "embedding": [...],
  "metadata": {
    "tags": [],
    "type": "architecture"
  }
}
```

---

## 🧠 Indexação do Vault

Script:

```
python scripts/ingest_vault.py
```

### Responsabilidades:

* Ler todos os `.md`
* Gerar embeddings
* Inserir no vector DB

---

## 🔐 Segurança

### Regras obrigatórias:

#### 1. Whitelist de paths

```
allowed_paths = ["notes/", "ai/"]
```

---

#### 2. Proteção contra overwrite crítico

* Bloquear:

  * `architecture/`
  * `core/`

---

#### 3. Sanitização de input

* Validar path
* Evitar path traversal (`../`)

---

## ⚠️ Boas práticas MCP

* Tools devem ter descrições claras (impacta diretamente performance do agente)
* Manter schemas simples
* Evitar retorno excessivo (limite de contexto)

---

## ⚙️ Execução

### Rodar o servidor

```
python main.py
```

---

### Configuração no Codex

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "python",
      "args": ["main.py"]
    }
  }
}
```

---

## 🧪 Testes

Testar manualmente:

1. Listar tools
2. Ler nota existente
3. Criar nova nota
4. Rodar busca semântica

---

## 🚀 Próximos passos (fora do escopo inicial)

* Auto-indexação (watch filesystem)
* Versionamento de notas
* Multi-agent system (writer / reviewer)
* Linking automático entre notas

---

## 🧠 Resultado esperado

Após implementação:

* Codex consegue:

  * ler seu vault
  * escrever documentação automaticamente
  * responder com base no seu conhecimento
  * usar seu Obsidian como memória persistente

---

## 📌 Observação final

Este MCP server transforma o Obsidian em:

👉 **uma base de conhecimento acessível por agentes em tempo real**

---

[1]: https://json-rpc.dev/learn/mcp-basics?utm_source=chatgpt.com "MCP (Model Context Protocol) Tutorial - Understanding JSON-RPC for AI Integration | JSON-RPC Tools"
[2]: https://modelcontextprotocol.io/docs/concepts/tools?utm_source=chatgpt.com "Tools - Model Context Protocol"
