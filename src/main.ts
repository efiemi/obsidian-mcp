import { MCPServer } from "./mcp/server.js";

const main = async (): Promise<void> => {
  await new MCPServer().runStdio();
};

void main();
