import fs from 'fs';
import path from 'path';

/**
 * Simple JSON file-based storage for development
 * In production, this should be replaced with a proper database or cloud storage
 */

const getDataDir = () => {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
};

export async function readJson<T = any>(filename: string): Promise<T> {
  try {
    const filePath = path.join(getDataDir(), filename);

    if (!fs.existsSync(filePath)) {
      // Return empty object/array based on filename convention
      const defaultValue = filename.includes('[]') || filename.startsWith('list_') ? [] : {};
      return defaultValue as T;
    }

    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data) as T;
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    // Return appropriate default value
    const defaultValue = filename.includes('[]') || filename.startsWith('list_') ? [] : {};
    return defaultValue as T;
  }
}

export async function writeJson<T = any>(filename: string, data: T): Promise<void> {
  try {
    const filePath = path.join(getDataDir(), filename);
    const jsonString = JSON.stringify(data, null, 2);

    fs.writeFileSync(filePath, jsonString, 'utf8');
  } catch (error) {
    console.error(`Error writing ${filename}:`, error);
    throw new Error(`Failed to write ${filename}`);
  }
}

export async function updateJson<T = any>(
  filename: string,
  updater: (current: T) => T
): Promise<T> {
  try {
    const current = await readJson<T>(filename);
    const updated = updater(current);
    await writeJson(filename, updated);
    return updated;
  } catch (error) {
    console.error(`Error updating ${filename}:`, error);
    throw new Error(`Failed to update ${filename}`);
  }
}

/**
 * Atomic update with retry mechanism
 */
export async function atomicUpdate<T = any>(
  filename: string,
  updater: (current: T) => T,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await updateJson(filename, updater);
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries - 1) {
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error(`Failed to update ${filename} after ${maxRetries} attempts`);
}