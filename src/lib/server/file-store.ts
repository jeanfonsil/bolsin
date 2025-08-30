/**
 * File Store - Gerenciamento em memória de arquivos
 * Para produção, considere usar Redis ou banco de dados
 */

interface FileData {
  buffer: Buffer
  metadata: {
    originalName: string
    fileType: string
    mimeType: string
    size: number
    uploadedAt: string
  }
}

// Store global em memória (Node.js)
declare global {
  var fileStore: Map<string, FileData> | undefined
}

export function getFileStore(): Map<string, FileData> {
  if (!global.fileStore) {
    console.log('🗃️ Inicializando file store...')
    global.fileStore = new Map<string, FileData>()
  }
  return global.fileStore
}

export function clearFileStore(): void {
  if (global.fileStore) {
    global.fileStore.clear()
    console.log('🗑️ File store limpo')
  }
}

// Utilitários para debugging
export function getFileStoreStats() {
  const store = getFileStore()
  const files = Array.from(store.entries()).map(([id, data]) => ({
    id,
    name: data.metadata.originalName,
    size: data.metadata.size,
    type: data.metadata.fileType,
    uploadedAt: data.metadata.uploadedAt
  }))

  return {
    totalFiles: store.size,
    totalSizeBytes: files.reduce((sum, f) => sum + f.size, 0),
    files
  }
}