export type StoredFile = {
  buffer: Buffer
  metadata: any
}

const STORE_KEY = '__bolsin_file_store__'

export function getFileStore(): Map<string, StoredFile> {
  const g = global as unknown as Record<string, any>
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = new Map<string, StoredFile>()
  }
  return g[STORE_KEY] as Map<string, StoredFile>
}

