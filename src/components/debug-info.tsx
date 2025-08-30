'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Bug, 
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react'

interface APIStatus {
  endpoint: string
  status: 'loading' | 'success' | 'error'
  response?: any
  error?: string
}

export function DebugInfo() {
  const [isVisible, setIsVisible] = useState(false)
  const [apis, setApis] = useState<APIStatus[]>([])

  const testAPIs = async () => {
    const endpoints = ['/api/upload', '/api/health', '/api/debug']
    const results: APIStatus[] = []

    for (const endpoint of endpoints) {
      results.push({ endpoint, status: 'loading' })
      setApis([...results])

      try {
        const response = await fetch(endpoint)
        const data = await response.json()
        
        results[results.length - 1] = {
          endpoint,
          status: response.ok ? 'success' : 'error',
          response: data
        }
      } catch (error) {
        results[results.length - 1] = {
          endpoint,
          status: 'error',
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        }
      }
      
      setApis([...results])
    }
  }

  const testFullFlow = async () => {
    try {
      console.log('🧪 === TESTE COMPLETO DO FLUXO ===')
      
      // 1. Criar arquivo de teste
      console.log('1️⃣ Criando arquivo de teste...')
      const testContent = 'data,descricao,valor\n01/01/2024,TESTE,100.50\n02/01/2024,UBER,25.30'
      const testFile = new File([testContent], 'fluxo-completo.csv', { type: 'text/csv' })
      
      // 2. Upload
      console.log('2️⃣ Fazendo upload...')
      const formData = new FormData()
      formData.append('file', testFile)
      
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      
      const uploadResult = await uploadResponse.json()
      console.log('📤 Upload resultado:', uploadResult)
      
      if (!uploadResult.success) {
        throw new Error('Upload falhou: ' + uploadResult.error)
      }
      
      const fileId = uploadResult.data.fileId
      console.log('🆔 FileId obtido:', fileId)
      
      // 3. Verificar debug
      console.log('3️⃣ Verificando stores...')
      const debugResponse = await fetch('/api/debug')
      const debugData = await debugResponse.json()
      console.log('🔍 Debug data:', debugData)
      
      // 4. Processar
      console.log('4️⃣ Processando arquivo...')
      const processResponse = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId })
      })
      
      const processResult = await processResponse.json()
      console.log('⚙️ Process resultado:', processResult)
      
      // 5. Resultado
      if (processResult.success) {
        alert('🎉 FLUXO COMPLETO FUNCIONOU!\n\n' + 
              `Transações: ${processResult.data.transactions}\n` +
              `Categorias: ${processResult.data.categories.length}`)
      } else {
        alert('❌ Falha no processamento:\n' + processResult.error)
      }
      
    } catch (error) {
      console.error('💥 Erro no teste completo:', error)
      alert('Erro no teste: ' + (error instanceof Error ? error.message : 'Erro desconhecido'))
    }
  }

  const testFileUpload = async () => {
    try {
      const testContent = 'data,descricao,valor\n01/01/2024,TESTE,100.50'
      const testFile = new File([testContent], 'debug-teste.csv', { type: 'text/csv' })
      
      const formData = new FormData()
      formData.append('file', testFile)
      
      console.log('🧪 Debug: Enviando arquivo teste...')
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      
      const result = await response.json()
      
      console.log('🧪 Debug: Resposta do upload:', result)
      
      alert(`Upload teste: ${response.ok ? 'SUCESSO' : 'FALHA'}\n\nResposta: ${JSON.stringify(result, null, 2)}`)
      
    } catch (error) {
      console.error('🧪 Debug: Erro no upload teste:', error)
      alert('Erro no upload teste: ' + (error instanceof Error ? error.message : 'Erro desconhecido'))
    }
  }

  useEffect(() => {
    // Debug automático na abertura
    if (isVisible && apis.length === 0) {
      testAPIs()
    }
  }, [isVisible])

  if (!isVisible) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50"
      >
        <Bug className="h-4 w-4 mr-2" />
        Debug
      </Button>
    )
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 max-h-96 overflow-auto z-50 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center">
            <Bug className="h-4 w-4 mr-2" />
            Debug Info
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
          >
            ✕
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 text-xs">
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={testAPIs}>
            <RefreshCw className="h-3 w-3 mr-1" />
            APIs
          </Button>
          <Button variant="outline" size="sm" onClick={testFileUpload}>
            📤 Upload
          </Button>
          <Button variant="outline" size="sm" onClick={testFullFlow}>
            🔄 Fluxo
          </Button>
        </div>

        <div className="space-y-2">
          {apis.map((api, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <div className="flex items-center space-x-2">
                {api.status === 'loading' && <RefreshCw className="h-3 w-3 animate-spin" />}
                {api.status === 'success' && <CheckCircle className="h-3 w-3 text-green-600" />}
                {api.status === 'error' && <XCircle className="h-3 w-3 text-red-600" />}
                <span className="font-mono">{api.endpoint}</span>
              </div>
              
              <Badge variant={
                api.status === 'success' ? 'default' :
                api.status === 'error' ? 'destructive' :
                'secondary'
              }>
                {api.status}
              </Badge>
            </div>
          ))}
        </div>

        {apis.some(api => api.response || api.error) && (
          <div className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-32">
            <strong>Última resposta:</strong>
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(
                apis.find(api => api.response || api.error)?.response ||
                apis.find(api => api.response || api.error)?.error,
                null, 2
              )}
            </pre>
          </div>
        )}

        <div className="text-gray-500 text-xs">
          <div>Ambiente: {process.env.NODE_ENV}</div>
          <div>Timestamp: {new Date().toLocaleTimeString()}</div>
        </div>
      </CardContent>
    </Card>
  )
}