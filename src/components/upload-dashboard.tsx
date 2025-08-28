'use client'

import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock,
  Brain,
  Download,
  Eye,
  Trash2,
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react'
import { DebugPanel } from '@/components/debug-panel'

interface UploadedFile {
  averageConfidence: number
  categoryDistribution: string[] | undefined
  metadata: any
  id: string
  name: string
  size: number
  type: string
  status: 'uploading' | 'processing' | 'completed' | 'error'
  progress: number
  transactions?: number
  categories?: string[]
  uploadedAt: Date
  error?: string
  aiAnalysis?: {
    averageConfidence: number
    categoryDistribution: Record<string, number>
    processingTime: number
    sampleTransactions?: any[]
  }
}

export default function UploadDashboard() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [dragActive, setDragActive] = useState(false)

const processFile = useCallback(async (file: File) => {
  console.log('🚨 === DEBUG UPLOAD/PROCESS ===')
  console.log('📤 Arquivo recebido:', file.name, file.size, 'bytes', file.type)
  
  // ID temporário para UI
  const tempId = 'temp-' + Math.random().toString(36).substr(2, 9)
  console.log('🆔 TempId gerado:', tempId)
  
  const newFile: UploadedFile = {
    id: tempId,
    name: file.name,
    size: file.size,
    type: file.type,
    status: 'uploading',
    progress: 0,
    uploadedAt: new Date(),
    metadata: undefined,
    averageConfidence: 0,
    categoryDistribution: undefined
  }

  setFiles(prev => [newFile, ...prev])

  // Definir realFileId no escopo da função inteira
  let realFileId: string | null = null

  try {
    // ETAPA 1: Upload real do arquivo
    console.log('📤 Upload real iniciado:', file.name)
    
    const formData = new FormData()
    formData.append('file', file)
    formData.append('userId', 'anonymous')

    // Progress simulado durante upload
    const uploadInterval = setInterval(() => {
      setFiles(prev => prev.map(f => {
        if (f.id === tempId && f.status === 'uploading') {
          const newProgress = Math.min(f.progress + 10, 90)
          return { ...f, progress: newProgress }
        }
        return f
      }))
    }, 200)

    console.log('🌐 Fazendo request para /api/upload...')
    const uploadResponse = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    })

    clearInterval(uploadInterval)

    console.log('🚨 Upload response status:', uploadResponse.status)
    console.log('🚨 Upload response headers:', Object.fromEntries(uploadResponse.headers.entries()))

    if (!uploadResponse.ok) {
      let errorMessage = `HTTP ${uploadResponse.status}`
      
      try {
        const errorData = await uploadResponse.json()
        errorMessage = errorData.error || errorData.message || errorMessage
        console.log('❌ Upload error data:', errorData)
      } catch (jsonError) {
        try {
          const errorText = await uploadResponse.text()
          console.log('❌ Upload error text:', errorText)
          errorMessage = errorText.substring(0, 200)
        } catch (textError) {
          console.log('❌ Erro ao ler resposta:', textError)
        }
      }
      
      throw new Error(errorMessage)
    }

    const uploadResult = await uploadResponse.json()
    console.log('🚨 Upload result completo:', uploadResult)

    if (!uploadResult.success || !uploadResult.data?.id) {
      throw new Error('Upload retornou dados inválidos')
    }

    // Atribuir valor para realFileId AQUI
    realFileId = uploadResult.data.id
    console.log('🚨 ID real do backend:', realFileId)
    
    // Atualizar com ID real do backend
    setFiles(prev => prev.map(f => 
      f.id === tempId 
        ? { 
            ...f, 
            id: realFileId!,
            status: 'processing' as const,
            progress: 100,
            metadata: uploadResult.data 
          }
        : f
    ))

    // ETAPA 2: Processar com IA real
    console.log('🚨 Iniciando processamento IA com ID:', realFileId)

    const processInterval = setInterval(() => {
      setFiles(prev => prev.map(f => {
        if (f.id === realFileId && f.status === 'processing') {
          const newProgress = Math.min(f.progress + 8, 95)
          return { ...f, progress: newProgress }
        }
        return f
      }))
    }, 500)

    console.log('🌐 Fazendo request para /api/process...')
    const processResponse = await fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: realFileId })
    })

    clearInterval(processInterval)

    console.log('🚨 Process response status:', processResponse.status)

    if (!processResponse.ok) {
      let errorMessage = `HTTP ${processResponse.status}`
      
      try {
        const errorData = await processResponse.json()
        errorMessage = errorData.error || errorData.message || errorMessage
        console.log('❌ Process error data:', errorData)
      } catch (jsonError) {
        const errorText = await processResponse.text()
        console.log('❌ Process error text:', errorText)
        errorMessage = errorText.substring(0, 200)
      }
      
      throw new Error(`Erro no processamento: ${errorMessage}`)
    }

    const processResult = await processResponse.json()
    console.log('🚨 Process result COMPLETO:', processResult)

    if (!processResult.success) {
      throw new Error(processResult.error || 'Processamento falhou')
    }

    console.log('🚨 SampleTransactions recebidas:', processResult.data.sampleTransactions?.length)
    console.log('🚨 Primeira sample transaction:', processResult.data.sampleTransactions?.[0])

    // ETAPA 3: Finalizar com dados reais
    setFiles(prev => prev.map(f => 
      f.id === realFileId 
        ? {
            ...f,
            status: 'completed' as const,
            progress: 100,
            transactions: processResult.data.transactionCount,
            categories: processResult.data.categories,
            averageConfidence: processResult.data.averageConfidence,
            categoryDistribution: processResult.data.categoryDistribution,
            // Dados extras da IA
            aiAnalysis: {
              averageConfidence: processResult.data.averageConfidence,
              categoryDistribution: processResult.data.categoryDistribution,
              processingTime: processResult.data.processingTime,
              sampleTransactions: processResult.data.sampleTransactions // DADOS REAIS!
            }
          }
        : f
    ))

    console.log('🎉 Arquivo processado com sucesso!')

  } catch (error) {
    console.error('🚨 ERRO NO PROCESSAMENTO:', error)
    console.error('🚨 Stack trace:', error instanceof Error ? error.stack : 'No stack')
    
    // Usar o ID correto: realFileId se disponível, senão tempId
    const errorId = realFileId || tempId
    
    setFiles(prev => prev.map(f => 
      f.id === errorId
        ? { 
            ...f, 
            status: 'error' as const,
            progress: 0,
            error: error instanceof Error ? error.message : String(error)
          }
        : f
    ))

    console.log('🚨 Erro detalhado:', error instanceof Error ? error.message : String(error))
  }
}, [])

// 2️⃣ FUNÇÃO downloadExtract COM DEBUG:
const downloadExtract = async (fileId: string) => {
  console.log('🚨 === DEBUG DOWNLOAD ===')
  console.log('📥 FileId para download:', fileId)
  
  try {
    const fileData = files.find(f => f.id === fileId)
    console.log('🚨 FileData local encontrado:', !!fileData)
    console.log('🚨 FileData completo:', JSON.stringify(fileData, null, 2))
    
    if (!fileData) {
      throw new Error('Arquivo não encontrado')
    }

    console.log('🚨 Status do arquivo:', fileData.status)
    console.log('🚨 Tem aiAnalysis?', !!fileData.aiAnalysis)
    console.log('🚨 Tem sampleTransactions?', !!fileData.aiAnalysis?.sampleTransactions)
    console.log('🚨 Quantidade sampleTransactions:', fileData.aiAnalysis?.sampleTransactions?.length)

    if (fileData.status !== 'completed') {
      alert('❌ Arquivo ainda não foi processado')
      return
    }

    let csvData: any[] = []

    // STEP 1: TENTAR BUSCAR DADOS DA API DOWNLOAD
    console.log('🚨 Buscando dados da API /download...')
    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId })
      })

      console.log('🚨 Response /download status:', response.status)
      
      if (response.ok) {
        const downloadData = await response.json()
        console.log('🚨 Dados da API download:', downloadData)
        console.log('🚨 Sucesso?', downloadData.success)
        console.log('🚨 Fonte:', downloadData.source)
        console.log('🚨 Transações API:', downloadData.data?.transactions?.length)
        
        if (downloadData.success && downloadData.data?.transactions) {
          console.log('🚨 PRIMEIRA TRANSAÇÃO DA API:', downloadData.data.transactions[0])
          
          csvData = downloadData.data.transactions.map((transaction: any, index: number) => ({
            'ID': index + 1,
            'Data': new Date(transaction.date).toLocaleDateString('pt-BR'),
            'Descrição': transaction.description,
            'Valor': `R$ ${Math.abs(transaction.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            'Tipo': transaction.type === 'debit' ? 'Débito' : 'Crédito',
            'Categoria': transaction.category || 'Outros',
            'Confiança IA': `${((transaction.confidence || transaction.aiConfidence || 0) * 100).toFixed(1)}%`,
            'Processado em': new Date().toLocaleString('pt-BR'),
            'DEBUG_ORIGINAL': JSON.stringify(transaction)
          }))
          
          console.log('🚨 DADOS CSV PREPARADOS (primeiros 3):')
          csvData.slice(0, 3).forEach((row, i) => {
            console.log(`   [${i}]:`, row)
          })
        }
      }
    } catch (apiError) {
      console.log('🚨 ERRO API download:', apiError)
    }

    // STEP 2: SE API FALHOU, USAR DADOS LOCAIS
    if (csvData.length === 0 && fileData.aiAnalysis?.sampleTransactions) {
      console.log('🚨 Usando dados locais sampleTransactions...')
      console.log('🚨 Dados locais:', fileData.aiAnalysis.sampleTransactions)
      
      csvData = fileData.aiAnalysis.sampleTransactions.map((transaction: any, index: number) => ({
        'ID': index + 1,
        'Data': new Date(transaction.date).toLocaleDateString('pt-BR'),
        'Descrição': transaction.description,
        'Valor': `R$ ${Math.abs(transaction.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        'Tipo': transaction.type === 'debit' ? 'Débito' : 'Crédito',
        'Categoria': transaction.category || 'Outros',
        'Confiança IA': `${((transaction.confidence || 0) * 100).toFixed(1)}%`,
        'Processado em': new Date().toLocaleString('pt-BR'),
        'DEBUG_LOCAL': 'dados-locais'
      }))
    }

    // VERIFICAÇÃO FINAL
    if (csvData.length === 0) {
      console.log('🚨 NENHUM DADO ENCONTRADO!')
      alert('❌ Nenhum dado processado encontrado!')
      return
    }

    console.log(`🚨 TOTAL DE ${csvData.length} TRANSAÇÕES PARA DOWNLOAD`)
    console.log('🚨 Primeira linha do CSV:', csvData[0])

    // Gerar CSV
    const headers = Object.keys(csvData[0])
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => 
        headers.map(header => {
          const value = row[header]
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        }).join(',')
      )
    ].join('\n')

    const BOM = '\uFEFF'
    const finalContent = BOM + csvContent

    // Download
    const blob = new Blob([finalContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')
    const fileName = `bolsin_processado_DEBUG_${fileData.name.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.csv`
    link.download = fileName
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    setTimeout(() => URL.revokeObjectURL(link.href), 100)

    alert(`🚨 Download DEBUG concluído!\n\n📊 ${csvData.length} transações\n📁 ${fileName}`)

  } catch (error) {
    console.error('🚨 ERRO DOWNLOAD:', error)
    alert('❌ ' + (error instanceof Error ? error.message : 'Erro desconhecido'))
  }
}

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragActive(false)
    
    const droppedFiles = Array.from(e.dataTransfer.files)
    droppedFiles.forEach(file => {
      if (validateFile(file)) {
        processFile(file)
      }
    })
  }, [processFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    selectedFiles.forEach(file => {
      if (validateFile(file)) {
        processFile(file)
      }
    })
  }, [processFile])

  const validateFile = (file: File): boolean => {
    const validTypes = [
      'application/pdf', 
      'text/csv', 
      'application/vnd.ms-excel', 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
    const maxSize = 10 * 1024 * 1024 // 10MB
    
    if (!validTypes.includes(file.type)) {
      alert('Tipo de arquivo não suportado. Use PDF, CSV, XLS ou XLSX.')
      return false
    }
    
    if (file.size > maxSize) {
      alert('Arquivo muito grande. Máximo 10MB.')
      return false
    }
    
    return true
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
        return <Clock className="h-5 w-5 text-blue-500 animate-spin" />
      case 'processing':
        return <Brain className="h-5 w-5 text-purple-500 animate-pulse" />
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return null
    }
  }

  const getStatusText = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
        return 'Enviando...'
      case 'processing':
        return 'IA processando...'
      case 'completed':
        return 'Concluído'
      case 'error':
        return 'Erro'
      default:
        return ''
    }
  }

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  // Função para testar IA
  const testAI = async () => {
    console.log('🧪 Testando IA...')
    
    try {
      const testDescription = 'UBER EATS PEDIDO 12345'
      const response = await fetch(`/api/categorize?description=${encodeURIComponent(testDescription)}`)
      const result = await response.json()
      
      if (result.success) {
        console.log('✅ Teste IA bem-sucedido:', result.data)
        alert(`IA funcionando!\nCategoria: ${result.data.category}\nConfiança: ${(result.data.confidence * 100).toFixed(1)}%`)
      } else {
        console.error('❌ Teste IA falhou:', result.error)
        alert(`Erro no teste IA: ${result.error}`)
      }
    } catch (error) {
      console.error('❌ Erro teste IA:', error)
      alert(`Erro de conexão: ${error}`)
    }
  }

  // Função para testar APIs reais
  const testRealAPI = async () => {
    console.log('🧪 Testando APIs reais...')
    
    try {
      // Teste 1: Health check das APIs
      console.log('1. Testando API de categorização...')
      const catResponse = await fetch('/api/categorize?description=UBER EATS TESTE')
      const catResult = await catResponse.json()
      
      if (catResult.success) {
        console.log('✅ API Categorização OK:', catResult.data)
      } else {
        throw new Error('API Categorização falhou')
      }

      // Teste 2: Verificar se upload funciona (sem arquivo)
      console.log('2. Testando estrutura API Upload...')
      const uploadResponse = await fetch('/api/upload', { method: 'POST', body: new FormData() })
      // Esperamos erro 400 (sem arquivo) - isso é normal
      if (uploadResponse.status === 400) {
        console.log('✅ API Upload estrutura OK')
      }

      alert('🎉 APIs funcionando! Upload um arquivo de teste.')

    } catch (error) {
      console.error('❌ Teste falhou:', error)
      alert(`Erro nos testes: ${error}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="container mx-auto max-w-6xl">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard do Bolsin</h1>
              <p className="text-gray-600">Transforme seus extratos bancários em planilhas organizadas</p>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">B</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Bolsin
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <FileText className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{files.length}</p>
                    <p className="text-sm text-gray-600">Extratos enviados</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Brain className="h-8 w-8 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      {files.filter(f => f.status === 'completed').reduce((acc, f) => acc + (f.transactions || 0), 0)}
                    </p>
                    <p className="text-sm text-gray-600">Transações processadas</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{files.filter(f => f.status === 'completed').length}</p>
                    <p className="text-sm text-gray-600">Concluídos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Upload Area */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="h-5 w-5" />
              <span>Enviar Novo Extrato</span>
            </CardTitle>
            <CardDescription>
              Arraste e solte seus arquivos PDF ou CSV aqui, ou clique para selecionar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                dragActive 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
            >
              <Upload className={`mx-auto h-12 w-12 mb-4 ${
                dragActive ? 'text-blue-500' : 'text-gray-400'
              }`} />
              
              <div className="space-y-2">
                <p className="text-lg font-medium">
                  Arraste seus extratos aqui
                </p>
                <p className="text-gray-500">
                  ou
                </p>
                <div>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.csv,.xls,.xlsx"
                    onChange={handleFileInput}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload">
                    <Button className="cursor-pointer">
                      Selecionar Arquivos
                    </Button>
                  </label>
                </div>
                <p className="text-sm text-gray-500">
                  Suportamos PDF, CSV, XLS e XLSX até 10MB
                </p>
              </div>
            </div>

            {/* Supported Banks Info */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900 mb-1">Bancos Suportados</p>
                  <p className="text-sm text-blue-700">
                    Nubank, Itaú, Bradesco, Banco do Brasil, Santander, Caixa, BTG, Inter, C6 Bank e mais
                  </p>
                </div>
              </div>
            </div>

            {/* Test Buttons */}
            <div className="mt-4 pt-4 border-t flex gap-2">
              <Button
                onClick={testAI}
                variant="outline"
                size="sm"
                className="text-purple-600 border-purple-600 hover:bg-purple-50"
              >
                🧠 Testar IA
              </Button>
              
              <Button
                onClick={testRealAPI}
                variant="outline"
                size="sm"
                className="text-green-600 border-green-600 hover:bg-green-50"
              >
                🔌 Testar APIs
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Files List */}
        {files.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Extratos Recentes</CardTitle>
              <CardDescription>
                Acompanhe o progresso dos seus uploads e processamentos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {files.map((file) => (
                  <div key={file.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <FileSpreadsheet className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{file.name}</p>
                          <p className="text-sm text-gray-500">
                            {formatFileSize(file.size)} • {file.uploadedAt.toLocaleDateString()}
                          </p>
                          {file.error && (
                            <p className="text-sm text-red-600">Erro: {file.error}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(file.status)}
                          <Badge variant={
                            file.status === 'completed' ? 'default' :
                            file.status === 'error' ? 'destructive' :
                            'secondary'
                          }>
                            {getStatusText(file.status)}
                          </Badge>
                        </div>

                        <div className="flex items-center space-x-1">
                          {file.status === 'completed' && (
                            <>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-green-600 hover:text-green-700"
                                onClick={() => downloadExtract(file.id)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => removeFile(file.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {(file.status === 'uploading' || file.status === 'processing') && (
                      <div className="mb-3">
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                          <span>{getStatusText(file.status)}</span>
                          <span>{Math.round(file.progress)}%</span>
                        </div>
                        <Progress value={file.progress} className="h-2" />
                      </div>
                    )}

                    {/* Results */}
                    {file.status === 'completed' && file.transactions && (
                      <div className="bg-green-50 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="text-center">
                              <p className="text-2xl font-bold text-green-600">{file.transactions}</p>
                              <p className="text-xs text-gray-600">transações</p>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-bold text-green-600">{file.categories?.length || 0}</p>
                              <p className="text-xs text-gray-600">categorias</p>
                            </div>
                            {file.aiAnalysis && (
                              <div className="text-center">
                                <p className="text-2xl font-bold text-green-600">
                                  {(file.aiAnalysis.averageConfidence * 100).toFixed(0)}%
                                </p>
                                <p className="text-xs text-gray-600">confiança IA</p>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex space-x-2">
                            <Button size="sm" className="bg-green-600 hover:bg-green-700">
                              <Download className="h-4 w-4 mr-1" />
                              Baixar Planilha
                            </Button>
                          </div>
                        </div>
                        
                        {file.categories && (
                          <div className="mt-3">
                            <p className="text-sm text-gray-600 mb-2">Categorias encontradas:</p>
                            <div className="flex flex-wrap gap-1">
                              {file.categories.map((category, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {category}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {files.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <FileSpreadsheet className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum extrato enviado ainda</h3>
              <p className="text-gray-500 mb-6">
                Comece fazendo upload do seu primeiro extrato bancário
              </p>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                Fazer Primeiro Upload
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      
      <DebugPanel />
    </div>
  )
}