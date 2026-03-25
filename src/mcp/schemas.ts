export const READ_NOTE_SCHEMA = {
  type: "object",
  properties: { path: { type: "string" } },
  required: ["path"]
};

export const WRITE_NOTE_SCHEMA = {
  type: "object",
  properties: {
    path: { type: "string" },
    content: { type: "string" }
  },
  required: ["path", "content"]
};

export const SEARCH_NOTES_SCHEMA = {
  type: "object",
  properties: { query: { type: "string" } },
  required: ["query"]
};

export const LIST_PATH_SCHEMA = {
  type: "object",
  properties: { path: { type: "string" } }
};

export const GET_NOTE_METADATA_SCHEMA = {
  type: "object",
  properties: { path: { type: "string" } },
  required: ["path"]
};

export const GET_NOTE_LINKS_SCHEMA = {
  type: "object",
  properties: { path: { type: "string" } },
  required: ["path"]
};

export const GET_BACKLINKS_SCHEMA = {
  type: "object",
  properties: { path: { type: "string" } },
  required: ["path"]
};

export const GET_OUTGOING_LINKS_SCHEMA = {
  type: "object",
  properties: { path: { type: "string" } },
  required: ["path"]
};

export const GET_GRAPH_CONTEXT_SCHEMA = {
  type: "object",
  properties: {
    path: { type: "string" },
    topK: { type: "number" }
  },
  required: ["path"]
};

export const APPEND_TO_NOTE_SCHEMA = {
  type: "object",
  properties: {
    path: { type: "string" },
    content: { type: "string" }
  },
  required: ["path", "content"]
};

export const UPDATE_SECTION_SCHEMA = {
  type: "object",
  properties: {
    path: { type: "string" },
    heading: { type: "string" },
    content: { type: "string" }
  },
  required: ["path", "heading", "content"]
};

export const CREATE_NOTE_FROM_TEMPLATE_SCHEMA = {
  type: "object",
  properties: {
    template: { type: "string" },
    data: { type: "object" },
    path: { type: "string" }
  },
  required: ["template", "data"]
};

export const HYBRID_SEARCH_SCHEMA = {
  type: "object",
  properties: {
    query: { type: "string" },
    topK: { type: "number" }
  },
  required: ["query"]
};

export const GET_SIMILAR_NOTES_SCHEMA = {
  type: "object",
  properties: {
    path: { type: "string" },
    topK: { type: "number" }
  },
  required: ["path"]
};

export const SUMMARIZE_NOTES_SCHEMA = {
  type: "object",
  properties: {
    paths: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["paths"]
};
