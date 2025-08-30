/**
 * MonitoringService - Sistema de monitoramento e logs
 * Versão simplificada para MVP
 */

interface ProcessLog {
  fileId: string
  process: string
  startTime: number
  endTime?: number
  status: 'started' | 'completed' | 'error'
  data?: any
  error?: string
}

export class MonitoringService {
  private static instance: MonitoringService
  private logs: Map<string, ProcessLog[]> = new Map()

  private constructor() {}

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService()
    }
    return MonitoringService.instance
  }

  startProcess(fileId: string, process: string, data?: any): void {
    if (!this.logs.has(fileId)) {
      this.logs.set(fileId, [])
    }

    const log: ProcessLog = {
      fileId,
      process,
      startTime: Date.now(),
      status: 'started',
      data
    }

    this.logs.get(fileId)!.push(log)
    console.log(`🟡 [${process}] Iniciado para ${fileId}`, data || '')
  }

  completeProcess(fileId: string, process: string, data?: any): void {
    const logs = this.logs.get(fileId) || []
    const log = logs.find(l => l.process === process && l.status === 'started')

    if (log) {
      log.status = 'completed'
      log.endTime = Date.now()
      log.data = { ...log.data, ...data }

      const duration = log.endTime - log.startTime
      console.log(`🟢 [${process}] Concluído para ${fileId} em ${duration}ms`, data || '')
    } else {
      console.warn(`⚠️ Log não encontrado para ${process}/${fileId}`)
    }
  }

  errorProcess(fileId: string, process: string, error: string, data?: any): void {
    const logs = this.logs.get(fileId) || []
    const log = logs.find(l => l.process === process && l.status === 'started')

    if (log) {
      log.status = 'error'
      log.endTime = Date.now()
      log.error = error
      log.data = { ...log.data, ...data }

      const duration = log.endTime - log.startTime
      console.error(`🔴 [${process}] Erro para ${fileId} em ${duration}ms:`, error)
    } else {
      // Criar log de erro mesmo sem início
      const errorLog: ProcessLog = {
        fileId,
        process,
        startTime: Date.now(),
        endTime: Date.now(),
        status: 'error',
        error,
        data
      }

      if (!this.logs.has(fileId)) {
        this.logs.set(fileId, [])
      }
      this.logs.get(fileId)!.push(errorLog)
      console.error(`🔴 [${process}] Erro para ${fileId}:`, error)
    }
  }

  getProcessLogs(fileId: string): ProcessLog[] {
    return this.logs.get(fileId) || []
  }

  getAllLogs(): ProcessLog[] {
    return Array.from(this.logs.values()).flat()
  }

  getStats() {
    const allLogs = this.getAllLogs()
    const completed = allLogs.filter(l => l.status === 'completed')
    const errors = allLogs.filter(l => l.status === 'error')
    
    return {
      totalProcesses: allLogs.length,
      completed: completed.length,
      errors: errors.length,
      avgDuration: completed.length > 0 
        ? Math.round(completed.reduce((sum, log) => 
            sum + ((log.endTime || 0) - log.startTime), 0) / completed.length)
        : 0,
      recentErrors: errors.slice(-5).map(log => ({
        fileId: log.fileId,
        process: log.process,
        error: log.error,
        timestamp: new Date(log.startTime).toISOString()
      }))
    }
  }

  clearLogs(): void {
    this.logs.clear()
    console.log('🗑️ Logs de monitoramento limpos')
  }

  // ✅ Métodos adicionais para compatibilidade com Health API
  getSystemMetrics() {
    const allLogs = this.getAllLogs()
    const completed = allLogs.filter(l => l.status === 'completed')
    const errors = allLogs.filter(l => l.status === 'error')
    const active = allLogs.filter(l => l.status === 'started')
    
    return {
      totalProcessed: completed.length,
      successfulProcessing: completed.length,
      failedProcessing: errors.length,
      currentActiveProcesses: active.length,
      averageProcessingTime: completed.length > 0 
        ? Math.round(completed.reduce((sum, log) => 
            sum + ((log.endTime || 0) - log.startTime), 0) / completed.length)
        : 0,
      uptime: Math.round(process.uptime()),
      memoryUsage: process.memoryUsage(),
      cacheHitRate: 0.95 // Simulado
    }
  }

  getHealthReport() {
    const stats = this.getStats()
    const errorRate = stats.totalProcesses > 0 ? stats.errors / stats.totalProcesses : 0
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    const issues: string[] = []
    const recommendations: string[] = []
    
    if (errorRate > 0.5) {
      status = 'critical'
      issues.push('Taxa de erro alta (>50%)')
      recommendations.push('Verificar logs de erro')
    } else if (errorRate > 0.2) {
      status = 'warning'
      issues.push('Taxa de erro moderada (>20%)')
      recommendations.push('Monitorar processos')
    }
    
    if (stats.avgDuration > 30000) {
      status = status === 'critical' ? 'critical' : 'warning'
      issues.push('Processamento lento (>30s)')
      recommendations.push('Otimizar algoritmos')
    }
    
    return {
      status,
      issues,
      recommendations,
      statistics: stats
    }
  }
}