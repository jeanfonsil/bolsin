interface ProcessingMetrics {
  fileId: string
  startTime: number
  endTime?: number
  stage: 'upload' | 'parsing' | 'categorization' | 'download' | 'error'
  duration?: number
  success: boolean
  error?: string
  metadata?: Record<string, any>
}

interface SystemMetrics {
  totalProcessed: number
  successfulProcessing: number
  failedProcessing: number
  averageProcessingTime: number
  currentActiveProcesses: number
  cacheHitRate: number
  errorsByType: Record<string, number>
  processingByStage: Record<string, number>
}

export class MonitoringService {
  private static instance: MonitoringService
  private metrics: ProcessingMetrics[] = []
  private readonly MAX_METRICS = 1000 // Manter apenas as últimas 1000
  
  private constructor() {
    // Limpeza periódica
    setInterval(() => this.cleanup(), 5 * 60 * 1000) // A cada 5 minutos
  }

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService()
    }
    return MonitoringService.instance
  }

  // Registrar início de processo
  startProcess(fileId: string, stage: ProcessingMetrics['stage'], metadata?: Record<string, any>): void {
    console.log(`📊 Monitor: Iniciando ${stage} para ${fileId}`)
    
    const metric: ProcessingMetrics = {
      fileId,
      startTime: Date.now(),
      stage,
      success: false,
      metadata
    }
    
    this.metrics.push(metric)
    this.enforceMaxMetrics()
  }

  // Registrar sucesso
  completeProcess(fileId: string, stage: ProcessingMetrics['stage'], metadata?: Record<string, any>): void {
    const metric = this.findMetric(fileId, stage)
    
    if (metric) {
      metric.endTime = Date.now()
      metric.duration = metric.endTime - metric.startTime
      metric.success = true
      metric.metadata = { ...metric.metadata, ...metadata }
      
      console.log(`✅ Monitor: ${stage} concluído para ${fileId} em ${metric.duration}ms`)
    }
  }

  // Registrar erro
  errorProcess(fileId: string, stage: ProcessingMetrics['stage'], error: string, metadata?: Record<string, any>): void {
    const metric = this.findMetric(fileId, stage)
    
    if (metric) {
      metric.endTime = Date.now()
      metric.duration = metric.endTime - metric.startTime
      metric.success = false
      metric.error = error
      metric.metadata = { ...metric.metadata, ...metadata }
      
      console.log(`❌ Monitor: ${stage} falhou para ${fileId} em ${metric.duration}ms - ${error}`)
    }
  }

  // Obter métricas do sistema
  getSystemMetrics(): SystemMetrics {
    const completedMetrics = this.metrics.filter(m => m.endTime)
    const totalProcessed = completedMetrics.length
    const successfulProcessing = completedMetrics.filter(m => m.success).length
    const failedProcessing = totalProcessed - successfulProcessing
    
    const averageProcessingTime = totalProcessed > 0
      ? completedMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / totalProcessed
      : 0
    
    const currentActiveProcesses = this.metrics.filter(m => !m.endTime).length
    
    // Cache hit rate (simulado - integrar com CacheManager)
    const cacheHitRate = this.calculateCacheHitRate()
    
    // Erros por tipo
    const errorsByType = completedMetrics
      .filter(m => !m.success && m.error)
      .reduce((acc, m) => {
        const errorType = this.categorizeError(m.error!)
        acc[errorType] = (acc[errorType] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    
    // Processamento por etapa
    const processingByStage = this.metrics.reduce((acc, m) => {
      acc[m.stage] = (acc[m.stage] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return {
      totalProcessed,
      successfulProcessing,
      failedProcessing,
      averageProcessingTime,
      currentActiveProcesses,
      cacheHitRate,
      errorsByType,
      processingByStage
    }
  }

  // Obter métricas de um arquivo específico
  getFileMetrics(fileId: string): ProcessingMetrics[] {
    return this.metrics
      .filter(m => m.fileId === fileId)
      .sort((a, b) => a.startTime - b.startTime)
  }

  // Obter métricas das últimas N horas
  getRecentMetrics(hours: number = 24): ProcessingMetrics[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000)
    return this.metrics
      .filter(m => m.startTime > cutoff)
      .sort((a, b) => b.startTime - a.startTime)
  }

  // Detectar problemas recorrentes
  getHealthReport(): {
    status: 'healthy' | 'warning' | 'critical'
    issues: string[]
    recommendations: string[]
  } {
    const recent = this.getRecentMetrics(1) // Última hora
    const issues: string[] = []
    const recommendations: string[] = []
    
    const recentFailures = recent.filter(m => !m.success).length
    const recentTotal = recent.length
    const failureRate = recentTotal > 0 ? recentFailures / recentTotal : 0
    
    if (failureRate > 0.5) {
      issues.push('Taxa de falha alta (>50%)')
      recommendations.push('Verificar logs de erro e validação de arquivos')
    }
    
    const longProcessing = recent.filter(m => m.duration && m.duration > 30000).length
    if (longProcessing > 0) {
      issues.push(`${longProcessing} processamentos lentos (>30s)`)
      recommendations.push('Otimizar parser ou limite de transações')
    }
    
    const activeProcesses = this.getSystemMetrics().currentActiveProcesses
    if (activeProcesses > 10) {
      issues.push(`Muitos processos ativos (${activeProcesses})`)
      recommendations.push('Verificar possível travamento ou leak')
    }
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    if (issues.length > 0) {
      status = failureRate > 0.8 || activeProcesses > 20 ? 'critical' : 'warning'
    }
    
    return { status, issues, recommendations }
  }

  // Método privado para encontrar métrica específica
  private findMetric(fileId: string, stage: ProcessingMetrics['stage']): ProcessingMetrics | undefined {
    return this.metrics
      .filter(m => m.fileId === fileId && m.stage === stage)
      .sort((a, b) => b.startTime - a.startTime)[0] // Mais recente
  }

  // Categorizar tipos de erro
  private categorizeError(error: string): string {
    const errorLower = error.toLowerCase()
    
    if (errorLower.includes('data') || errorLower.includes('date')) {
      return 'date_parsing_error'
    }
    if (errorLower.includes('csv') || errorLower.includes('parsing')) {
      return 'csv_parsing_error'
    }
    if (errorLower.includes('ia') || errorLower.includes('categoriz')) {
      return 'ai_categorization_error'
    }
    if (errorLower.includes('upload') || errorLower.includes('arquivo')) {
      return 'file_upload_error'
    }
    if (errorLower.includes('cache') || errorLower.includes('memória')) {
      return 'cache_error'
    }
    
    return 'unknown_error'
  }

  // Simular cache hit rate - integrar com CacheManager real
  private calculateCacheHitRate(): number {
    const recentCacheEvents = this.metrics
      .filter(m => m.metadata?.cached !== undefined)
      .slice(-100) // Últimos 100 eventos
    
    if (recentCacheEvents.length === 0) return 0
    
    const cacheHits = recentCacheEvents.filter(m => m.metadata?.cached === true).length
    return cacheHits / recentCacheEvents.length
  }

  // Limpeza automática
  private cleanup(): void {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000) // 7 dias
    const before = this.metrics.length
    
    this.metrics = this.metrics.filter(m => m.startTime > cutoff)
    
    const removed = before - this.metrics.length
    if (removed > 0) {
      console.log(`🧹 Monitor: Removidas ${removed} métricas antigas`)
    }
  }

  // Forçar limite máximo
  private enforceMaxMetrics(): void {
    if (this.metrics.length > this.MAX_METRICS) {
      const excess = this.metrics.length - this.MAX_METRICS
      this.metrics = this.metrics.slice(excess)
      console.log(`📏 Monitor: Removidas ${excess} métricas por limite`)
    }
  }

  // Exportar dados para análise
  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = ['fileId', 'stage', 'startTime', 'endTime', 'duration', 'success', 'error']
      const rows = this.metrics.map(m => [
        m.fileId,
        m.stage,
        new Date(m.startTime).toISOString(),
        m.endTime ? new Date(m.endTime).toISOString() : '',
        m.duration || '',
        m.success,
        m.error || ''
      ])
      
      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    }
    
    return JSON.stringify(this.metrics, null, 2)
  }
}