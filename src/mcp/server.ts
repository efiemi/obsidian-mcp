import { ObsidianClient } from "../obsidian/client.js";
import { InMemoryVectorStore } from "../rag/vector-store.js";
import {
  APPEND_TO_NOTE_SCHEMA,
  CREATE_NOTE_FROM_TEMPLATE_SCHEMA,
  GET_SIMILAR_NOTES_SCHEMA,
  GET_BACKLINKS_SCHEMA,
  GET_GRAPH_CONTEXT_SCHEMA,
  GET_NOTE_LINKS_SCHEMA,
  GET_NOTE_METADATA_SCHEMA,
  GET_OUTGOING_LINKS_SCHEMA,
  HYBRID_SEARCH_SCHEMA,
  LIST_PATH_SCHEMA,
  READ_NOTE_SCHEMA,
  SEARCH_NOTES_SCHEMA,
  SUMMARIZE_NOTES_SCHEMA,
  UPDATE_SECTION_SCHEMA,
  WRITE_NOTE_SCHEMA
} from "./schemas.js";
import {
  appendToNote,
  createNoteFromTemplate,
  getBacklinks,
  getGraphContext,
  getNoteLinks,
  getNoteMetadata,
  getOutgoingLinks,
  listFolders,
  listNotes,
  readNote,
  updateSection,
  writeNote
} from "./tools/notes.js";
import { getSimilarNotes, hybridSearch, semanticSearch, summarizeNotes } from "./tools/rag.js";
import { searchNotes } from "./tools/search.js";

type JsonRpcRequest = {
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

type ToolSpec = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

type ResponseMode = "content-length" | "line-json";

export class MCPServer {
  private static readonly DEFAULT_PROTOCOL_VERSION = "2024-11-05";

  private client: ObsidianClient | null = null;

  private readonly store = new InMemoryVectorStore();

  private readonly tools: Record<string, { spec: ToolSpec; handler: ToolHandler }> = {
    read_note: {
      spec: {
        name: "read_note",
        description: "Read a note from Obsidian vault",
        inputSchema: READ_NOTE_SCHEMA
      },
      handler: async (args) => readNote(this.getClient(), String(args.path ?? ""))
    },
    write_note: {
      spec: {
        name: "write_note",
        description: "Write or overwrite a note",
        inputSchema: WRITE_NOTE_SCHEMA
      },
      handler: async (args) =>
        writeNote(this.getClient(), String(args.path ?? ""), String(args.content ?? ""))
    },
    append_to_note: {
      spec: {
        name: "append_to_note",
        description: "Append content to a note without replacing existing content",
        inputSchema: APPEND_TO_NOTE_SCHEMA
      },
      handler: async (args) =>
        appendToNote(this.getClient(), String(args.path ?? ""), String(args.content ?? ""))
    },
    update_section: {
      spec: {
        name: "update_section",
        description: "Update or create a markdown heading section in a note",
        inputSchema: UPDATE_SECTION_SCHEMA
      },
      handler: async (args) =>
        updateSection(
          this.getClient(),
          String(args.path ?? ""),
          String(args.heading ?? ""),
          String(args.content ?? "")
        )
    },
    create_note_from_template: {
      spec: {
        name: "create_note_from_template",
        description: "Create a new note from a named template and input data",
        inputSchema: CREATE_NOTE_FROM_TEMPLATE_SCHEMA
      },
      handler: async (args) =>
        createNoteFromTemplate(
          this.getClient(),
          String(args.template ?? ""),
          args.data ?? {},
          args.path
        )
    },
    search_notes: {
      spec: {
        name: "search_notes",
        description: "Search notes by keyword",
        inputSchema: SEARCH_NOTES_SCHEMA
      },
      handler: async (args) => searchNotes(this.getClient(), String(args.query ?? ""))
    },
    list_notes: {
      spec: {
        name: "list_notes",
        description: "List markdown notes recursively under an optional folder",
        inputSchema: LIST_PATH_SCHEMA
      },
      handler: async (args) => listNotes(this.getClient(), String(args.path ?? ""))
    },
    list_folders: {
      spec: {
        name: "list_folders",
        description: "List folders recursively under an optional folder",
        inputSchema: LIST_PATH_SCHEMA
      },
      handler: async (args) => listFolders(this.getClient(), String(args.path ?? ""))
    },
    get_note_metadata: {
      spec: {
        name: "get_note_metadata",
        description: "Return metadata for a note path: size, tags, created date and backlinks",
        inputSchema: GET_NOTE_METADATA_SCHEMA
      },
      handler: async (args) => getNoteMetadata(this.getClient(), String(args.path ?? ""))
    },
    get_note_links: {
      spec: {
        name: "get_note_links",
        description: "Return outgoing and incoming links for a note path",
        inputSchema: GET_NOTE_LINKS_SCHEMA
      },
      handler: async (args) => getNoteLinks(this.getClient(), String(args.path ?? ""))
    },
    get_backlinks: {
      spec: {
        name: "get_backlinks",
        description: "Return notes that reference a note path",
        inputSchema: GET_BACKLINKS_SCHEMA
      },
      handler: async (args) => getBacklinks(this.getClient(), String(args.path ?? ""))
    },
    get_outgoing_links: {
      spec: {
        name: "get_outgoing_links",
        description: "Return links contained in a note path",
        inputSchema: GET_OUTGOING_LINKS_SCHEMA
      },
      handler: async (args) => getOutgoingLinks(this.getClient(), String(args.path ?? ""))
    },
    get_graph_context: {
      spec: {
        name: "get_graph_context",
        description: "Return related notes and semantic cluster for a note path",
        inputSchema: GET_GRAPH_CONTEXT_SCHEMA
      },
      handler: async (args) =>
        getGraphContext(
          this.getClient(),
          String(args.path ?? ""),
          typeof args.topK === "number" ? Number(args.topK) : undefined
        )
    },
    semantic_search: {
      spec: {
        name: "semantic_search",
        description: "Semantic search across notes using embeddings",
        inputSchema: SEARCH_NOTES_SCHEMA
      },
      handler: async (args) => semanticSearch(this.store, String(args.query ?? ""))
    },
    hybrid_search: {
      spec: {
        name: "hybrid_search",
        description: "Hybrid retrieval combining keyword and semantic ranking",
        inputSchema: HYBRID_SEARCH_SCHEMA
      },
      handler: async (args) =>
        hybridSearch(
          this.getClient(),
          this.store,
          String(args.query ?? ""),
          typeof args.topK === "number" ? Number(args.topK) : undefined
        )
    },
    get_similar_notes: {
      spec: {
        name: "get_similar_notes",
        description: "Find semantically similar notes from a note path",
        inputSchema: GET_SIMILAR_NOTES_SCHEMA
      },
      handler: async (args) =>
        getSimilarNotes(
          this.getClient(),
          this.store,
          String(args.path ?? ""),
          typeof args.topK === "number" ? Number(args.topK) : undefined
        )
    },
    summarize_notes: {
      spec: {
        name: "summarize_notes",
        description: "Summarize multiple notes for context preparation",
        inputSchema: SUMMARIZE_NOTES_SCHEMA
      },
      handler: async (args) => {
        const paths = Array.isArray(args.paths) ? args.paths.map(String) : [];
        return summarizeNotes(this.getClient(), paths);
      }
    }
  };

  private responseMode: ResponseMode = "content-length";

  private getClient(): ObsidianClient {
    if (!this.client) {
      this.client = new ObsidianClient();
    }
    return this.client;
  }

  private async handleMessage(message: JsonRpcRequest): Promise<Record<string, unknown> | null> {
    const requestId = message.id ?? null;
    const method = message.method;
    const params = message.params ?? {};

    try {
      let result: unknown;

      if (method === "initialize") {
        const clientProtocolVersion =
          typeof params.protocolVersion === "string" ? params.protocolVersion : undefined;
        result = {
          protocolVersion: clientProtocolVersion || MCPServer.DEFAULT_PROTOCOL_VERSION,
          serverInfo: { name: "obsidian-mcp", version: "0.1.0" },
          capabilities: { tools: {} }
        };
      } else if (method === "notifications/initialized" || method === "initialized") {
        return null;
      } else if (method === "tools/list") {
        result = { tools: Object.values(this.tools).map((tool) => tool.spec) };
      } else if (method === "tools/call") {
        const toolName = String(params.name ?? "");
        const argumentsValue = (params.arguments ?? {}) as Record<string, unknown>;

        const selectedTool = this.tools[toolName];
        if (!selectedTool) {
          throw new Error(`Unknown tool: ${toolName}`);
        }

        const output = await selectedTool.handler(argumentsValue);
        result = {
          content: [
            {
              type: "text",
              text: typeof output === "string" ? output : JSON.stringify(output)
            }
          ]
        };
      } else {
        throw new Error(`Unknown method: ${String(method)}`);
      }

      if (requestId === null) {
        return null;
      }

      return { jsonrpc: "2.0", id: requestId, result };
    } catch (error) {
      if (requestId === null) {
        return null;
      }
      return {
        jsonrpc: "2.0",
        id: requestId,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : "Unknown server error"
        }
      };
    }
  }

  private writeMessage(message: Record<string, unknown>): void {
    const payload = JSON.stringify(message);

    if (this.responseMode === "line-json") {
      process.stdout.write(`${payload}\n`);
      return;
    }

    const body = Buffer.from(payload, "utf-8");
    process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
    process.stdout.write(body);
  }

  private writeParseError(): void {
    this.writeMessage({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" }
    });
  }

  async runStdio(): Promise<void> {
    const stdin = process.stdin;
    let buffer = Buffer.alloc(0);
    let processing = false;

    const consumeLeadingBlankLines = (): void => {
      while (buffer.length > 0) {
        if (buffer[0] === 0x0a) {
          buffer = buffer.subarray(1);
          continue;
        }
        if (buffer.length >= 2 && buffer[0] === 0x0d && buffer[1] === 0x0a) {
          buffer = buffer.subarray(2);
          continue;
        }
        break;
      }
    };

    const handleParsedMessage = async (request: JsonRpcRequest): Promise<void> => {
      const response = await this.handleMessage(request);
      if (response) {
        this.writeMessage(response);
      }
    };

    const processBuffer = async (): Promise<void> => {
      if (processing) {
        return;
      }
      processing = true;
      try {
        while (true) {
          consumeLeadingBlankLines();
          if (buffer.length === 0) {
            return;
          }

          // JSON per line mode.
          if (buffer[0] === 0x7b) {
            const newlineIndex = buffer.indexOf(0x0a);
            if (newlineIndex < 0) {
              return;
            }

            const rawLine = buffer.subarray(0, newlineIndex).toString("utf-8").trim();
            buffer = buffer.subarray(newlineIndex + 1);
            if (!rawLine) {
              continue;
            }

            this.responseMode = "line-json";
            try {
              await handleParsedMessage(JSON.parse(rawLine) as JsonRpcRequest);
            } catch {
              this.writeParseError();
            }
            continue;
          }

          // Content-Length mode.
          const crlfHeaderEnd = buffer.indexOf("\r\n\r\n");
          const lfHeaderEnd = buffer.indexOf("\n\n");
          const useCrlf = crlfHeaderEnd >= 0 && (lfHeaderEnd < 0 || crlfHeaderEnd < lfHeaderEnd);
          const headerEnd = useCrlf ? crlfHeaderEnd : lfHeaderEnd;
          const delimiterSize = useCrlf ? 4 : 2;

          if (headerEnd < 0) {
            return;
          }

          const headerText = buffer.subarray(0, headerEnd).toString("utf-8");
          const contentLengthMatch = /content-length:\s*(\d+)/i.exec(headerText);
          if (!contentLengthMatch) {
            buffer = buffer.subarray(headerEnd + delimiterSize);
            this.writeParseError();
            continue;
          }

          const contentLength = Number.parseInt(contentLengthMatch[1], 10);
          const messageStart = headerEnd + delimiterSize;
          const messageEnd = messageStart + contentLength;

          if (buffer.length < messageEnd) {
            return;
          }

          const body = buffer.subarray(messageStart, messageEnd).toString("utf-8");
          buffer = buffer.subarray(messageEnd);

          this.responseMode = "content-length";
          try {
            await handleParsedMessage(JSON.parse(body) as JsonRpcRequest);
          } catch {
            this.writeParseError();
          }
        }
      } finally {
        processing = false;
      }
    };

    stdin.on("data", (chunk: Buffer | string) => {
      const chunkBuffer = typeof chunk === "string" ? Buffer.from(chunk, "utf-8") : chunk;
      buffer = Buffer.concat([buffer, chunkBuffer]);
      void processBuffer();
    });

    stdin.resume();
    await new Promise<void>((resolve) => {
      stdin.on("end", () => resolve());
      stdin.on("close", () => resolve());
    });
  }
}
