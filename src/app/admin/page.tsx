'use client'

import React, { useState } from 'react'
import { MonitoringDashboard } from '@/components/monitoring-dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Shield, 
  Activity, 
  Database, 
  Zap, 
  FileText,
  Download,
  Trash2,
  RefreshCw
} from 'lucide-react'

export default function AdminPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const fetchSystemStats = async () => {
    setLoading(true)
    try {
      // Buscar estatísticas de várias APIs
      const [healthRes, cacheRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/upload') // GET para estatísticas
      ])
      
      const healthData = await healthRes.json()
      const cacheData = await cacheRes.json()
      
      setStats({
        health: healthData,
        cache: cacheData
      })
    } catch (error) {
      console.error('Erro ao buscar stats:', error)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchSystemStats()
  }, [])

  const clearCache = async () => {
    if (confirm('Tem certeza que deseja limpar o cache?')) {
      try {
        await fetch('/api/admin/clear-cache', { method: 'POST' })
        alert('Cache limpo com sucesso!')
        fetchSystemStats()
      } catch (error) {
        alert('Erro ao limpar cache')
      }
    }
  }

  const exportLogs = async () => {
    try {
      const response = await fetch('/api/admin/export-logs')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `bolsin_logs_${new Date().toISOString().slice(0, 10)}.json`
      link.click()
    } catch (error) {
      alert('Erro ao exportar logs')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto max-w-7xl">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center">
                <Shield className="h-8 w-8 mr-3" />
                Admin Dashboard
              </h1>
              <p className="text-gray-600">Monitoramento e administração do sistema</p>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button 
                variant="outline" 
                onClick={fetchSystemStats}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              
              <Button 
                variant="outline"
                onClick={exportLogs}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Logs
              </Button>
              
              <Button 
                variant="destructive"
                onClick={clearCache}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar Cache
              </Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="monitoring" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="monitoring">Monitoramento</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="cache">Cache</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          {/* Tab de Monitoramento */}
          <TabsContent value="monitoring">
            <MonitoringDashboard />
          </TabsContent>

          {/* Tab de Performance */}
          <TabsContent value="performance">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="h-5 w-5" />
                    <span>Métricas de Upload</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Uploads hoje:</span>
                      <Badge>42</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Taxa de sucesso:</span>
                      <Badge className="bg-green-100 text-green-800">95.2%</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Tempo médio:</span>
                      <Badge variant="outline">2.3s</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Tamanho médio:</span>
                      <Badge variant="outline">1.2MB</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Zap className="h-5 w-5" />
                    <span>IA/Categorização</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Transações processadas:</span>
                      <Badge>1,247</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Confiança média:</span>
                      <Badge className="bg-blue-100 text-blue-800">87.4%</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Tempo médio/transação:</span>
                      <Badge variant="outline">0.3s</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Erros hoje:</span>
                      <Badge variant="destructive">3</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>Parsing</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>CSVs parseados:</span>
                      <Badge>38</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Taxa de sucesso:</span>
                      <Badge className="bg-green-100 text-green-800">92.1%</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Bancos detectados:</span>
                      <Badge variant="outline">7</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Linhas/segundo:</span>
                      <Badge variant="outline">156</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Gráficos de Performance */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Performance ao Longo do Tempo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-gray-500">
                  [Gráfico de performance - implementar com Recharts]
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab de Cache */}
          <TabsContent value="cache">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Database className="h-5 w-5" />
                    <span>Status do Cache</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats?.cache ? (
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span>Total de entradas:</span>
                        <Badge>{stats.cache.cache?.totalEntries || 0}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Uso de memória:</span>
                        <Badge variant="outline">{stats.cache.cache?.memoryUsage || '0 MB'}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Entrada mais antiga:</span>
                        <Badge variant="outline" className="text-xs">
                          {stats.cache.cache?.oldestEntry ? 
                            new Date(stats.cache.cache.oldestEntry).toLocaleString() : 
                            'N/A'
                          }
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Hit rate:</span>
                        <Badge className="bg-green-100 text-green-800">85.2%</Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500">
                      Carregando estatísticas...
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Arquivos em Cache</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {/* Lista de arquivos - mockup */}
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="truncate">extrato_nubank_2024.csv</span>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">2.3MB</Badge>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="truncate">fatura_itau_janeiro.csv</span>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">1.8MB</Badge>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="truncate">movimentacao_bb_2024.csv</span>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">980KB</Badge>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab de Logs */}
          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Logs Recentes</span>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Atualizar
                    </Button>
                    <select className="text-sm border rounded px-2 py-1">
                      <option value="all">Todos os níveis</option>
                      <option value="error">Apenas erros</option>
                      <option value="warning">Avisos e erros</option>
                      <option value="info">Info e acima</option>
                    </select>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {/* Logs mockup */}
                  <div className="text-sm font-mono space-y-1">
                    <div className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                      <Badge variant="destructive" className="text-xs">ERROR</Badge>
                      <span className="text-gray-500">2024-08-30 15:23:45</span>
                      <span>CSV parsing failed: Invalid date format on line 45</span>
                    </div>
                    <div className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                      <Badge className="bg-yellow-100 text-yellow-800 text-xs">WARN</Badge>
                      <span className="text-gray-500">2024-08-30 15:22:12</span>
                      <span>High memory usage detected: 456MB</span>
                    </div>
                    <div className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                      <Badge className="bg-blue-100 text-blue-800 text-xs">INFO</Badge>
                      <span className="text-gray-500">2024-08-30 15:21:33</span>
                      <span>File processed successfully: extrato_nubank_2024.csv (247 transactions)</span>
                    </div>
                    <div className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                      <Badge className="bg-green-100 text-green-800 text-xs">SUCCESS</Badge>
                      <span className="text-gray-500">2024-08-30 15:20:18</span>
                      <span>AI categorization completed with 89.2% average confidence</span>
                    </div>
                    <div className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                      <Badge className="bg-blue-100 text-blue-800 text-xs">INFO</Badge>
                      <span className="text-gray-500">2024-08-30 15:19:45</span>
                      <span>Upload started: fatura_itau_janeiro.csv (1.8MB)</span>
                    </div>
                    <div className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                      <Badge variant="destructive" className="text-xs">ERROR</Badge>
                      <span className="text-gray-500">2024-08-30 15:18:22</span>
                      <span>OpenAI API timeout after 30s - retrying...</span>
                    </div>
                    <div className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                      <Badge className="bg-green-100 text-green-800 text-xs">SUCCESS</Badge>
                      <span className="text-gray-500">2024-08-30 15:17:56</span>
                      <span>Cache cleanup completed: removed 12 expired entries</span>
                    </div>
                    <div className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                      <Badge className="bg-yellow-100 text-yellow-800 text-xs">WARN</Badge>
                      <span className="text-gray-500">2024-08-30 15:16:33</span>
                      <span>Slow AI response detected: 8.2s for categorization</span>
                    </div>
                    <div className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                      <Badge className="bg-blue-100 text-blue-800 text-xs">INFO</Badge>
                      <span className="text-gray-500">2024-08-30 15:15:41</span>
                      <span>Health check passed: all systems operational</span>
                    </div>
                    <div className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                      <Badge className="bg-green-100 text-green-800 text-xs">SUCCESS</Badge>
                      <span className="text-gray-500">2024-08-30 15:14:28</span>
                      <span>Download completed: bolsin_processado_2024-08-30.csv</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}