/**
 * CacheManager - Sistema de cache em memória
 * Para produção, considere usar Redis
 */

interface CacheEntry<T = any> {
  data: T
  expires: number
  created: number
  accessed: number
  hits: number
}

export class CacheManager {
  private static instance: CacheManager
  private cache: Map<string, CacheEntry> = new Map()
  private defaultTTL: number = 1000 * 60 * 60 // 1 hora
  private maxEntries: number = 1000
  private totalHits: number = 0
  private totalMisses: number = 0

  private constructor() {}

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager()
    }
    return CacheManager.instance
  }

  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now()
    const expires = now + (ttl || this.defaultTTL)

    // Remover entradas antigas se necessário
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest()
    }

    this.cache.set(key, {
      data,
      expires,
      created: now,
      accessed: now,
      hits: 0
    })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.totalMisses++
      return null
    }

    const now = Date.now()
    
    // Verificar se expirou
    if (now > entry.expires) {
      this.cache.delete(key)
      this.totalMisses++
      return null
    }

    // Atualizar estatísticas
    entry.accessed = now
    entry.hits++
    this.totalHits++

    return entry.data as T
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
    this.totalHits = 0
    this.totalMisses = 0
  }

  getCacheStats() {
    const now = Date.now()
    let expiredEntries = 0
    let totalMemoryBytes = 0

    // Calcular estatísticas
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        expiredEntries++
      }
      
      // Estimativa de memória (básica)
      totalMemoryBytes += JSON.stringify(entry).length * 2 // UTF-16
    }

    const hitRate = this.totalHits + this.totalMisses > 0 
      ? this.totalHits / (this.totalHits + this.totalMisses) 
      : 0

    return {
      totalEntries: this.cache.size,
      expiredEntries,
      hitRate: `${(hitRate * 100).toFixed(1)}%`,
      totalHits: this.totalHits,
      totalMisses: this.totalMisses,
      memoryUsage: `${(totalMemoryBytes / 1024 / 1024).toFixed(2)} MB`
    }
  }

  // Limpar entradas expiradas
  cleanup(): number {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key)
        cleaned++
      }
    }

    return cleaned
  }

  private evictOldest(): void {
    let oldestKey = ''
    let oldestAccessed = Date.now()

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessed < oldestAccessed) {
        oldestAccessed = entry.accessed
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  // Métodos utilitários para uso específico
  cacheFileProcessing(fileId: string, data: any, ttl = 1000 * 60 * 30): void {
    this.set(`file_processing_${fileId}`, data, ttl) // 30 min
  }

  getCachedFileProcessing(fileId: string): any {
    return this.get(`file_processing_${fileId}`)
  }

  cacheAIResult(prompt: string, result: any, ttl = 1000 * 60 * 60 * 24): void {
    const key = `ai_${this.hashString(prompt)}`
    this.set(key, result, ttl) // 24 horas
  }

  getCachedAIResult(prompt: string): any {
    const key = `ai_${this.hashString(prompt)}`
    return this.get(key)
  }

  private hashString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36)
  }
}