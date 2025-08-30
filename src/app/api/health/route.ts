import { NextRequest, NextResponse } from 'next/server'
import { MonitoringService } from '@/lib/monitoring/monitoring'
import { CacheManager } from '@/lib/cache/cache-manager'
import { categorizeTransactions } from '@/lib/ai/categorization'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const health = {
    status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    checks: {} as Record<string, any>,
    responseTime: 0
  }

  try {
    // 1. VERIFICAR CACHE SYSTEM
    health.checks.cache = await checkCacheSystem()
    
    // 2. VERIFICAR IA/OPENAI
    health.checks.ai = await checkAISystem()
    
    // 3. VERIFICAR SISTEMA DE MONITORAMENTO
    health.checks.monitoring = await checkMonitoringSystem()
    
    // 4. VERIFICAR PARSERS
    health.checks.parsers = await checkParsers()
    
    // 5. VERIFICAR MEMORIA/RECURSOS
    health.checks.resources = await checkSystemResources()

    // Determinar status geral
    const failedChecks = Object.values(health.checks).filter(check => !check.healthy).length
    
    if (failedChecks === 0) {
      health.status = 'healthy'
    } else if (failedChecks <= 2) {
      health.status = 'degraded'
    } else {
      health.status = 'unhealthy'
    }

    health.responseTime = Date.now() - startTime

    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503

    return NextResponse.json(health, { status: statusCode })

  } catch (error) {
    health.status = 'unhealthy'
    health.responseTime = Date.now() - startTime
    health.checks.error = {
      healthy: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(health, { status: 503 })
  }
}

async function checkCacheSystem(): Promise<any> {
  try {
    const cacheManager = CacheManager.getInstance()
    const stats = cacheManager.getCacheStats()
    
    const memoryUsageMB = parseFloat(stats.memoryUsage.replace(' MB', ''))
    const isHealthy = stats.totalEntries >= 0 && memoryUsageMB < 500 // Max 500MB
    
    return {
      healthy: isHealthy,
      stats,
      timestamp: new Date().toISOString(),
      warnings: memoryUsageMB > 250 ? ['High memory usage'] : []
    }
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Cache check failed',
      timestamp: new Date().toISOString()
    }
  }
}

async function checkAISystem(): Promise<any> {
  try {
    const testStart = Date.now()
    
    // Teste básico da IA
    const testResult = await categorizeTransactions(['TESTE UBER EATS'])
    const testDuration = Date.now() - testStart
    
    const isHealthy = testResult.length > 0 && 
                     testResult[0].category !== undefined &&
                     testDuration < 10000 // Max 10s
    
    return {
      healthy: isHealthy,
      responseTime: testDuration,
      testResult: testResult[0],
      timestamp: new Date().toISOString(),
      warnings: testDuration > 5000 ? ['Slow AI response'] : []
    }
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'AI check failed',
      timestamp: new Date().toISOString()
    }
  }
}

async function checkMonitoringSystem(): Promise<any> {
  try {
    const monitoring = MonitoringService.getInstance()
    const systemMetrics = monitoring.getSystemMetrics()
    const healthReport = monitoring.getHealthReport()
    
    const isHealthy = healthReport.status !== 'critical'
    
    return {
      healthy: isHealthy,
      systemMetrics,
      healthReport,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Monitoring check failed',
      timestamp: new Date().toISOString()
    }
  }
}

async function checkParsers(): Promise<any> {
  try {
    // Teste básico do parser CSV
    const { CSVParser } = await import('@/lib/parsers/csv-parser')
    const parser = new CSVParser()
    
    const testCSV = 'data,descricao,valor\n01/01/2024,TESTE,100.50'
    const testStart = Date.now()
    const result = await parser.parseCSV(testCSV)
    const testDuration = Date.now() - testStart
    
    const isHealthy = result.transactions.length === 1 &&
                     result.transactions[0].amount === 100.50 &&
                     testDuration < 1000
    
    return {
      healthy: isHealthy,
      responseTime: testDuration,
      testResult: {
        transactionsFound: result.transactions.length,
        firstAmount: result.transactions[0]?.amount
      },
      timestamp: new Date().toISOString(),
      warnings: testDuration > 500 ? ['Slow parser'] : []
    }
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Parser check failed',
      timestamp: new Date().toISOString()
    }
  }
}

async function checkSystemResources(): Promise<any> {
  try {
    const memoryUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()
    
    // Converter para MB
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024)
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024)
    const rssMB = Math.round(memoryUsage.rss / 1024 / 1024)
    
    // Verificar se os recursos estão dentro dos limites
    const isHealthy = heapUsedMB < 512 && // Max 512MB heap
                     rssMB < 1024 // Max 1GB RSS
    
    const warnings = []
    if (heapUsedMB > 256) warnings.push('High heap usage')
    if (rssMB > 512) warnings.push('High RSS usage')
    
    return {
      healthy: isHealthy,
      memory: {
        heapUsed: `${heapUsedMB} MB`,
        heapTotal: `${heapTotalMB} MB`,
        rss: `${rssMB} MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: `${Math.round(process.uptime())} seconds`,
      warnings,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Resource check failed',
      timestamp: new Date().toISOString()
    }
  }
}

// POST para executar health check com detalhes específicos
export async function POST(request: NextRequest) {
  try {
    const { checks } = await request.json()
    const results: Record<string, any> = {}
    
    if (!checks || checks.includes('cache')) {
      results.cache = await checkCacheSystem()
    }
    
    if (!checks || checks.includes('ai')) {
      results.ai = await checkAISystem()
    }
    
    if (!checks || checks.includes('monitoring')) {
      results.monitoring = await checkMonitoringSystem()
    }
    
    if (!checks || checks.includes('parsers')) {
      results.parsers = await checkParsers()
    }
    
    if (!checks || checks.includes('resources')) {
      results.resources = await checkSystemResources()
    }
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      checks: results
    })
    
  } catch (error) {
    return NextResponse.json({
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}