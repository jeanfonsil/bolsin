interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
  metadata?: Record<string, any>
}

interface ProcessingCache {
  fileId: string
  originalFile: {
    buffer: Buffer
    metadata: any
  }
  parsedData?: {
    transactions: any[]
    metadata: any
  }
  categorizedData?: {
    transactions: any[]
    analysis: any
  }
  finalData?: {
    transactions: any[]
    downloadReady: boolean
  }
}

export class CacheManager {
  private static instance: CacheManager
  private fileCache = new Map<string, CacheEntry<ProcessingCache>>()
  private readonly DEFAULT_TTL = 24 * 60 * 60 * 1000 // 24 horas
  private readonly MAX_CACHE_SIZE = 100 // máximo 100 arquivos em cache

  private constructor() {
    // Limpeza automática a cada hora
    setInterval(() => this.cleanup(), 60 * 60 * 1000)
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager()
    }
    return CacheManager.instance
  }

  // Salvar arquivo original
  storeFile(fileId: string, buffer: Buffer, metadata: any): void {
    console.log(`💾 Cache: Armazenando arquivo ${fileId}`)
    
    const cacheEntry: CacheEntry<ProcessingCache> = {
      data: {
        fileId,
        originalFile: { buffer, metadata }
      },
      timestamp: Date.now(),
      expiresAt: Date.now() + this.DEFAULT_TTL
    }

    this.fileCache.set(fileId, cacheEntry)
    this.enforceMaxSize()
  }

  // Buscar arquivo
  getFile(fileId: string): { buffer: Buffer; metadata: any } | null {
    const entry = this.fileCache.get(fileId)
    
    if (!entry) {
      console.log(`❌ Cache miss: ${fileId}`)
      return null
    }

    if (this.isExpired(entry)) {
      console.log(`⏰ Cache expirado: ${fileId}`)
      this.fileCache.delete(fileId)
      return null
    }

    console.log(`✅ Cache hit: ${fileId}`)
    return entry.data.originalFile
  }

  // Salvar dados parseados
  storeParsedData(fileId: string, transactions: any[], metadata: any): void {
    console.log(`💾 Cache: Salvando dados parseados ${fileId}`)
    
    const entry = this.fileCache.get(fileId)
    if (entry) {
      entry.data.parsedData = { transactions, metadata }
    }
  }

  // Buscar dados parseados
  getParsedData(fileId: string): { transactions: any[]; metadata: any } | null {
    const entry = this.fileCache.get(fileId)
    
    if (!entry || this.isExpired(entry)) {
      return null
    }

    return entry.data.parsedData || null
  }

  // Salvar dados categorizados
  storeCategorizedData(fileId: string, transactions: any[], analysis: any): void {
    console.log(`💾 Cache: Salvando dados categorizados ${fileId}`)
    
    const entry = this.fileCache.get(fileId)
    if (entry) {
      entry.data.categorizedData = { transactions, analysis }
    }
  }

  // Buscar dados categorizados
  getCategorizedData(fileId: string): { transactions: any[]; analysis: any } | null {
    const entry = this.fileCache.get(fileId)
    
    if (!entry || this.isExpired(entry)) {
      return null
    }

    return entry.data.categorizedData || null
  }

  // Marcar como pronto para download
  markAsDownloadReady(fileId: string, finalTransactions: any[]): void {
    console.log(`✅ Cache: Marcando como pronto para download ${fileId}`)
    
    const entry = this.fileCache.get(fileId)
    if (entry) {
      entry.data.finalData = {
        transactions: finalTransactions,
        downloadReady: true
      }
    }
  }

  // Buscar dados finais para download
  getFinalData(fileId: string): { transactions: any[]; downloadReady: boolean } | null {
    const entry = this.fileCache.get(fileId)
    
    if (!entry || this.isExpired(entry)) {
      return null
    }

    return entry.data.finalData || null
  }

  // Verificar status do processamento
  getProcessingStatus(fileId: string): {
    hasFile: boolean
    hasParsed: boolean
    hasCategorized: boolean
    isReady: boolean
  } {
    const entry = this.fileCache.get(fileId)
    
    if (!entry || this.isExpired(entry)) {
      return {
        hasFile: false,
        hasParsed: false,
        hasCategorized: false,
        isReady: false
      }
    }

    return {
      hasFile: !!entry.data.originalFile,
      hasParsed: !!entry.data.parsedData,
      hasCategorized: !!entry.data.categorizedData,
      isReady: !!entry.data.finalData?.downloadReady
    }
  }

  // Invalidar cache específico
  invalidate(fileId: string): void {
    console.log(`🗑️ Cache: Invalidando ${fileId}`)
    this.fileCache.delete(fileId)
  }

  // Limpeza automática
  private cleanup(): void {
    console.log('🧹 Cache: Iniciando limpeza automática')
    
    const now = Date.now()
    let cleaned = 0

    for (const [fileId, entry] of this.fileCache.entries()) {
      if (this.isExpired(entry)) {
        this.fileCache.delete(fileId)
        cleaned++
      }
    }

    console.log(`🧹 Cache: ${cleaned} entradas expiradas removidas`)
    console.log(`📊 Cache: ${this.fileCache.size} entradas restantes`)
  }

  // Forçar limite máximo de entradas
  private enforceMaxSize(): void {
    if (this.fileCache.size <= this.MAX_CACHE_SIZE) {
      return
    }

    console.log(`📏 Cache: Limite excedido (${this.fileCache.size}/${this.MAX_CACHE_SIZE})`)
    
    // Remover entradas mais antigas
    const entries = Array.from(this.fileCache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
    
    const toRemove = entries.slice(0, this.fileCache.size - this.MAX_CACHE_SIZE)
    toRemove.forEach(([fileId]) => {
      this.fileCache.delete(fileId)
    })

    console.log(`📏 Cache: ${toRemove.length} entradas antigas removidas`)
  }

  private isExpired(entry: CacheEntry<ProcessingCache>): boolean {
    return Date.now() > entry.expiresAt
  }

  // Debug info
  getCacheStats(): {
    totalEntries: number
    memoryUsage: string
    oldestEntry: string
    newestEntry: string
  } {
    const entries = Array.from(this.fileCache.values())
    const totalSize = entries.reduce((sum, entry) => {
      return sum + (entry.data.originalFile?.buffer?.length || 0)
    }, 0)

    const timestamps = entries.map(e => e.timestamp).sort((a, b) => a - b)

    return {
      totalEntries: this.fileCache.size,
      memoryUsage: (totalSize / 1024 / 1024).toFixed(2) + ' MB',
      oldestEntry: timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : 'N/A',
      newestEntry: timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]).toISOString() : 'N/A'
    }
  }
}