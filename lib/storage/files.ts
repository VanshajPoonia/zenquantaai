import { access, mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

const DATA_ROOT = path.join(process.cwd(), 'data')
export const RUNTIME_DATA_DIR = path.join(DATA_ROOT, 'runtime')

export function resolveRuntimePath(fileName: string): string {
  return path.join(RUNTIME_DATA_DIR, fileName)
}

export async function ensureRuntimeDataDir(): Promise<void> {
  await mkdir(RUNTIME_DATA_DIR, { recursive: true })
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, 'utf8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  await ensureRuntimeDataDir()
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
}
