'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  TrendingUp,
  Server,
  Zap,
  RefreshCw,
  Wifi,
  Database,
  Brain,
  FileText
} from 'lucide-react'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  uptime: number
  responseTime: number
  checks: Record<string, any>
}

export function MonitoringDashboard() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const checkHealth = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/health')
      const data = await response.json()
      setHealthStatus(data)
    } catch (error) {
      console.error('Erro ao verificar health:', error)
      setError(error instanceof Error ? error.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkHealth()
    
    if (autoRefresh) {
      const interval = setInterval(checkHealth, 30000) // A cada 30s
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100 border-green-200'
      case 'degraded': return 'text-yellow-600 bg-yellow-100 border-yellow-200' 
      case 'unhealthy': return 'text-red-600 bg-red-100 border-red-200'
      default: return 'text-gray-600 bg-gray-100 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5" />
      case 'degraded': return <AlertTriangle className="h-5 w-5" />
      case 'unhealthy': return <AlertTriangle className="h-5 w-5" />
      default: return <Clock className="h-5 w-5" />
    }
  }

  const getCheckIcon = (checkName: string) => {
    switch (checkName) {
      case 'cache': return <Database className="h-5 w-5" />
      case 'ai': return <Brain className="h-5 w-5" />
      case 'parsers': return <FileText className="h-5 w-5" />
      case 'resources': return <Server className="h-5 w-5" />
      case 'monitoring': return <Activity className="h-5 w-5" />
      default: return <Wifi className="h-5 w-5" />
    }
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Erro ao carregar status do sistema: {error}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={checkHealth}
            className="ml-4"
          >
            Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!healthStatus) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>Carregando status do sistema...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header com status geral */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Server className="h-6 w-6" />
              <span>Status do Sistema</span>
            </CardTitle>
            
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                size="sm"
                onClick={checkHealth}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                Auto-refresh
              </Button>
              
              <Badge className={`border ${getStatusColor(healthStatus.status)}`}>
                {getStatusIcon(healthStatus.status)}
                <span className="ml-2 capitalize">{healthStatus.status}</span>
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {Math.round(healthStatus.uptime)}s
              </div>
              <div className="text-sm text-gray-500">Uptime</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {healthStatus.responseTime}ms
              </div>
              <div className="text-sm text-gray-500">Response Time</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {Object.values(healthStatus.checks).filter(c => c.healthy).length}
              </div>
              <div className="text-sm text-gray-500">Checks OK</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {Object.values(healthStatus.checks).filter(c => !c.healthy).length}
              </div>
              <div className="text-sm text-gray-500">Checks Failed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detalhes dos checks */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(healthStatus.checks).map(([checkName, checkData]) => (
          <Card key={checkName}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center space-x-2">
                  {getCheckIcon(checkName)}
                  <span className="capitalize">{checkName}</span>
                </div>
                {checkData.healthy ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                )}
              </CardTitle>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <Badge className={checkData.healthy ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {checkData.healthy ? 'OK' : 'FAILED'}
                  </Badge>
                </div>
                
                {checkData.responseTime && (
                  <div className="flex justify-between">
                    <span>Response:</span>
                    <span>{checkData.responseTime}ms</span>
                  </div>
                )}
                
                {checkData.error && (
                  <div className="text-red-600 text-xs bg-red-50 p-2 rounded">
                    {checkData.error}
                  </div>
                )}
                
                {checkData.warnings && checkData.warnings.length > 0 && (
                  <div className="text-yellow-700 text-xs bg-yellow-50 p-2 rounded">
                    {checkData.warnings.join(', ')}
                  </div>
                )}
                
                {/* Detalhes específicos por tipo de check */}
                {checkName === 'resources' && checkData.memory && (
                  <div className="text-xs text-gray-600">
                    <div>Heap: {checkData.memory.heapUsed}</div>
                    <div>RSS: {checkData.memory.rss}</div>
                  </div>
                )}
                
                {checkName === 'cache' && checkData.stats && (
                  <div className="text-xs text-gray-600">
                    <div>Entries: {checkData.stats.totalEntries}</div>
                    <div>Memory: {checkData.stats.memoryUsage}</div>
                  </div>
                )}
                
                {checkName === 'ai' && checkData.testResult && (
                  <div className="text-xs text-gray-600">
                    <div>Category: {checkData.testResult.category}</div>
                    <div>Confidence: {Math.round(checkData.testResult.confidence * 100)}%</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Timestamp */}
      <div className="text-center text-sm text-gray-500">
        Última atualização: {new Date(healthStatus.timestamp).toLocaleString()}
      </div>
    </div>
  )
}