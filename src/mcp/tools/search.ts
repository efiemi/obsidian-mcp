import { ObsidianClient } from "../../obsidian/client.js";

export const searchNotes = async (client: ObsidianClient, query: string) => client.searchNotes(query);
