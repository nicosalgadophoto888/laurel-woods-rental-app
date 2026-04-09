import { promises as fs } from "fs";
import path from "path";
import { seedState } from "./seed";

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "app-state.json");

function isReadOnlyFsError(error) {
  return error?.code === "EROFS" || error?.code === "EPERM" || error?.code === "EACCES";
}

async function ensureDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

export async function readState() {
  try {
    await ensureDir();
    const content = await fs.readFile(dataFile, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      try {
        await writeState(seedState);
      } catch (writeError) {
        if (!isReadOnlyFsError(writeError)) throw writeError;
      }
      return seedState;
    }

    if (isReadOnlyFsError(error)) {
      return seedState;
    }

    throw error;
  }
}

export async function writeState(state) {
  try {
    await ensureDir();
    await fs.writeFile(dataFile, JSON.stringify(state, null, 2), "utf8");
  } catch (error) {
    if (!isReadOnlyFsError(error)) throw error;
  }
  return state;
}
