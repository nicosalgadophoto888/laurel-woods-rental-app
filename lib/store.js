import { promises as fs } from "fs";
import path from "path";
import { seedState } from "./seed";

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "app-state.json");

async function ensureDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

export async function readState() {
  await ensureDir();
  try {
    const content = await fs.readFile(dataFile, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      await writeState(seedState);
      return seedState;
    }
    throw error;
  }
}

export async function writeState(state) {
  await ensureDir();
  await fs.writeFile(dataFile, JSON.stringify(state, null, 2), "utf8");
  return state;
}
