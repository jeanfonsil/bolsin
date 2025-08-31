'use client'

import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  FileSpreadsheet,
  TrendingUp,
  Activity
} from 'lucide-react'
import { DebugInfo } from './debug-info'

interface UploadedFile {
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
  analysis?: {
    averageConfidence: number
    categoryDistribution: Record<string, number>
    processingTime: number
    statistics?: any
  }
  validationWarnings?: string[]
  processedRows?: any[]
}

export default function UploadDashboard() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Função principal de upload melhorada
  const processFile = useCallback(async (file: File) => {
    console.log('🚨 === UPLOAD MELHORADO ===')
    console.log('📤 Arquivo:', file.name, file.size, 'bytes')
    
    const tempId = 'temp-' + Math.random().toString(36).substr(2, 9)
    
    // Criar entrada temporária na UI
    const newFile: UploadedFile = {
      id: tempId,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'uploading',
      progress: 0,
      uploadedAt: new Date()
    }
    
    setFiles(prev => [...prev, newFile])
    setIsProcessing(true)

    try {
      // ETAPA 1: Upload com validação
      console.log('📤 1. Fazendo upload...')
      setFiles(prev => prev.map(f => 
        f.id === tempId ? { ...f, progress: 10 } : f
      ))

      const formData = new FormData()
      formData.append('file', file)
      
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      
      console.log('🔍 Upload response status:', uploadResponse.status)
      console.log('🔍 Upload response headers:', Object.fromEntries(uploadResponse.headers.entries()))
      
      const uploadResult = await uploadResponse.json()
      console.log('🔍 Upload resultado RAW:', JSON.stringify(uploadResult, null, 2))
      console.log('🔍 uploadResult.success:', uploadResult.success)
      console.log('🔍 uploadResult.data:', uploadResult.data)
      console.log('🔍 uploadResult.data?.fileId:', uploadResult.data?.fileId)
      
      // ✅ Validação melhorada da resposta
      if (!uploadResult.success) {
        console.error('❌ Upload falhou:', uploadResult.error || uploadResult.message)
        throw new Error(uploadResult.error || uploadResult.message || 'Erro no upload')
      }

      if (!uploadResult.data) {
        console.error('❌ uploadResult.data ausente:', uploadResult)
        throw new Error('Upload retornou dados inválidos - data ausente')
      }

      if (!uploadResult.data.fileId) {
        console.error('❌ uploadResult.data.fileId ausente:', uploadResult.data)
        throw new Error('Upload retornou dados inválidos - fileId ausente')
      }

      const realFileId = uploadResult.data.fileId
      console.log('🆔 FileId real extraído:', realFileId)

      // Atualizar com dados do upload
      setFiles(prev => prev.map(f => 
        f.id === tempId 
          ? { 
              ...f, 
              id: realFileId,
              status: 'processing' as const,
              progress: 30,
              validationWarnings: uploadResult.data.validation?.warnings
            } 
          : f
      ))

      // ETAPA 2: Processamento 
      console.log('⚙️ 2. Processando arquivo...')
      setFiles(prev => prev.map(f => 
        f.id === realFileId ? { ...f, progress: 50 } : f
      ))

      // Se for PDF, solicitar senha opcional
      let password: string | undefined
      if ((uploadResult.data.type || '').toLowerCase() === 'pdf') {
        password = window.prompt('Se o PDF tiver senha, digite-a (opcional):') || undefined
      }

      let processResponse = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: realFileId, password })
      })

      // Se o servidor solicitar senha, perguntar novamente e tentar uma vez
      if (processResponse.status === 422) {
        const body = await processResponse.json().catch(() => ({}))
        if (body?.requiresPassword) {
          const retry = window.prompt('PDF protegido. Informe a senha para processar:')
          if (retry) {
            processResponse = await fetch('/api/process', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileId: realFileId, password: retry })
            })
          }
        }
      }
      
      const processResult = await processResponse.json()
      console.log('⚙️ Processamento resultado:', processResult)
      
      if (!processResult.success) {
        throw new Error(processResult.error || 'Erro no processamento')
      }

      // ETAPA 3: Finalização
      console.log('✅ 3. Finalizando...')
      setFiles(prev => prev.map(f => 
        f.id === realFileId ? { ...f, progress: 90 } : f
      ))

      // Atualizar com resultados finais
      setFiles(prev => prev.map(f => 
        f.id === realFileId
          ? { 
              ...f, 
              status: 'completed' as const,
              progress: 100,
              transactions: processResult.data.transactions,
              categories: processResult.data.categories,
              analysis: processResult.data.analysis,
              processedRows: processResult.data.rawTransactions || processResult.data.rows
            } : f
      ))

      console.log('🎉 Processamento completo!')

    } catch (error) {
      console.error('❌ ERRO:', error)
      
      const errorId = files.find(f => f.name === file.name)?.id || tempId
      
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
    } finally {
      setIsProcessing(false)
    }
  }, [files])

  // Download otimizado
  const downloadExtract = async (fileId: string) => {
    try {
      const fileData = files.find(f => f.id === fileId)
      
      if (!fileData || fileData.status !== 'completed') {
        throw new Error('Arquivo não está pronto para download')
      }

      console.log('📥 Iniciando download para:', fileId)

      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId })
      })
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Erro no download')
      }

      // Prefer processed rows from the client state when available
      const csvData = (fileData.processedRows as any[] | undefined)?.map((t: any, index: number) => ({
        ID: index + 1,
        Data: formatDateForDownload(t.date),
        Descrição: cleanDescription(t.description),
        Valor: formatCurrency(t.amount),
        Tipo: t.type === 'debit' ? 'Débito' : 'Crédito',
        Categoria: t.category || 'Outros',
        'Confiança IA': typeof t.aiConfidence === 'number' ? `${(t.aiConfidence * 100).toFixed(1)}%` : '—',
        Canal: t.channel || 'other',
        Direção: t.direction === 'in' ? 'Entrada' : 'Saída',
        Contraparte: t.counterparty || ''
      })) || (result.data.transactions as any[])

      // Gerar CSV otimizado (quote em vírgula, aspas, quebras de linha)
      const headers = Object.keys(csvData[0])
      const esc = (val: any) => {
        let s = val == null ? '' : String(val)
        // normalizar quebras de linha em espaço simples
        s = s.replace(/[\r\n]+/g, ' ')
        if (/[",\n\r]/.test(s)) {
          return '"' + s.replace(/"/g, '""') + '"'
        }
        return s
      }
      const rows = csvData.map(row => headers.map(h => esc(row[h as keyof typeof row])).join(','))
      const csvContent = [headers.join(','), ...rows].join('\r\n')

      // Download com BOM para Excel
      const BOM = '\uFEFF'
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      
      const timestamp = new Date().toISOString().slice(0, 10)
      link.download = `bolsin_${fileData.name.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.csv`
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      setTimeout(() => URL.revokeObjectURL(link.href), 100)

      console.log('✅ Download concluído')

    } catch (error) {
      console.error('❌ Erro no download:', error)
      alert('Erro no download: ' + (error instanceof Error ? error.message : 'Erro desconhecido'))
    }
  }

  // Handlers de drag and drop
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragActive(false)
    
    if (isProcessing) return
    
    const droppedFiles = Array.from(e.dataTransfer.files)
    droppedFiles.forEach(file => {
      if (validateFile(file)) {
        processFile(file)
      }
    })
  }, [processFile, isProcessing])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (isProcessing) return
    
    const selectedFiles = Array.from(e.target.files || [])
    selectedFiles.forEach(file => {
      if (validateFile(file)) {
        processFile(file)
      }
    })
  }, [processFile, isProcessing])

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

  // Utilitários de formatação
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
    }
  }

  // Helpers de formatação para CSV
  const formatDateForDownload = (dateInput: any): string => {
    if (!dateInput) return ''
    let date: Date
    if (typeof dateInput === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        const [y, m, d] = dateInput.split('-').map(Number)
        date = new Date(y, m - 1, d)
      } else {
        date = new Date(dateInput)
      }
    } else if (dateInput instanceof Date) {
      date = dateInput
    } else {
      return String(dateInput)
    }
    return isNaN(date.getTime()) ? String(dateInput) : date.toLocaleDateString('pt-BR')
  }
  const cleanDescription = (d: string) => (d || '').toString().trim().normalize('NFC').replace(/\s+/g, ' ').slice(0, 100)
  const formatCurrency = (n: number) => `R$ ${Math.abs(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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
    }
  }

  const removeFile = (id: string) => {
    if (isProcessing) return
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  // ✅ Função de teste da API
  const testAPI = async () => {
    console.log('🧪 === TESTE DA API ===')
    
    try {
      console.log('🔍 1. Testando GET /api/upload...')
      const getResponse = await fetch('/api/upload')
      const getData = await getResponse.json()
      console.log('✅ GET response:', getData)
      
      console.log('🔍 2. Criando arquivo de teste...')
      const testContent = 'data,descricao,valor\n01/01/2024,TESTE,100.50'
      const testFile = new File([testContent], 'teste.csv', { type: 'text/csv' })
      console.log('📄 Arquivo de teste criado:', testFile)
      
      console.log('🔍 3. Fazendo upload de teste...')
      const formData = new FormData()
      formData.append('file', testFile)
      
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      
      console.log('🔍 4. Status do upload:', uploadResponse.status)
      console.log('🔍 5. Headers:', Object.fromEntries(uploadResponse.headers.entries()))
      
      const uploadResult = await uploadResponse.json()
      console.log('🔍 6. Resultado completo:', JSON.stringify(uploadResult, null, 2))
      
      alert('Teste concluído! Veja o console para detalhes.')
      
    } catch (error) {
      console.error('💥 Erro no teste:', error)
      alert('Erro no teste: ' + (error instanceof Error ? error.message : 'Erro desconhecido'))
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="container mx-auto max-w-6xl">
        
        {/* Header melhorado */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center">
                <Brain className="h-8 w-8 mr-3 text-blue-600" />
                Bolsin AI
              </h1>
              <p className="text-gray-600">Transforme seus extratos em planilhas organizadas com inteligência artificial</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="px-3 py-1">
                <Activity className="h-4 w-4 mr-1" />
                {files.length} arquivo{files.length !== 1 ? 's' : ''}
              </Badge>
              {files.length > 0 && (
                <Badge variant="outline" className="px-3 py-1">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  {files.filter(f => f.status === 'completed').length} processado{files.filter(f => f.status === 'completed').length !== 1 ? 's' : ''}
                </Badge>
              )}
              
              {/* ✅ Botão de teste da API */}
              <Button variant="outline" size="sm" onClick={testAPI}>
                🧪 Testar API
              </Button>
            </div>
          </div>

          {/* Stats rápidas */}
          {files.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total de Transações</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {files.reduce((sum, f) => sum + (f.transactions || 0), 0)}
                      </p>
                    </div>
                    <FileSpreadsheet className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Categorias Encontradas</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {Array.from(new Set(files.flatMap(f => f.categories || []))).length}
                      </p>
                    </div>
                    <Activity className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Precisão Média</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {files.length > 0
                          ? Math.round(files.reduce((sum, f) => sum + (f.analysis?.averageConfidence || 0), 0) / files.length * 100)
                          : 0}%
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Área de upload melhorada */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Upload de Extrato</CardTitle>
            <CardDescription>
              Arraste e solte seu arquivo CSV ou clique para selecionar. Formatos suportados: CSV, PDF, XLS, XLSX (máx. 10MB)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                dragActive 
                  ? 'border-blue-500 bg-blue-50' 
                  : isProcessing 
                    ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
                    : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
              }`}
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault()
                if (!isProcessing) setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onClick={() => !isProcessing && document.getElementById('fileInput')?.click()}
            >
              <Upload className={`mx-auto h-12 w-12 mb-4 ${isProcessing ? 'text-gray-400' : 'text-gray-400'}`} />
              <p className="text-lg font-medium text-gray-900 mb-2">
                {isProcessing ? 'Processando...' : 'Solte seu arquivo aqui'}
              </p>
              <p className="text-sm text-gray-500">
                {isProcessing ? 
                  'Aguarde enquanto a IA processa seu extrato' : 
                  'ou clique para selecionar do seu computador'
                }
              </p>
              
              <input
                id="fileInput"
                type="file"
                className="hidden"
                accept=".csv,.pdf,.xls,.xlsx"
                onChange={handleFileInput}
                disabled={isProcessing}
              />
            </div>
          </CardContent>
        </Card>

        {/* Lista de arquivos */}
        {files.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Arquivos Processados</h2>
            
            {files.map((file) => (
              <Card key={file.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4">
                        <div className="mt-1">
                          <FileText className="h-8 w-8 text-blue-500" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="text-lg font-medium text-gray-900 truncate">
                              {file.name}
                            </h3>
                            <Badge variant={
                              file.status === 'completed' ? 'default' :
                              file.status === 'error' ? 'destructive' :
                              'secondary'
                            }>
                              {getStatusText(file.status)}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>{formatFileSize(file.size)}</span>
                            <span>{getStatusIcon(file.status)}</span>
                            <span>Enviado {file.uploadedAt.toLocaleTimeString()}</span>
                            {file.transactions && (
                              <span className="text-green-600 font-medium">
                                {file.transactions} transações
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {file.status === 'completed' && (
                          <Button 
                            size="sm" 
                            onClick={() => downloadExtract(file.id)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Baixar CSV
                          </Button>
                        )}
                        
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => removeFile(file.id)}
                          disabled={isProcessing && file.status !== 'completed'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Progress bar */}
                    {(file.status === 'uploading' || file.status === 'processing') && (
                      <Progress value={file.progress} className="mb-3" />
                    )}
                    
                    {/* Warnings */}
                    {file.validationWarnings && file.validationWarnings.length > 0 && (
                      <Alert className="mb-3">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Avisos:</strong> {file.validationWarnings.join(', ')}
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {/* Error display */}
                    {file.status === 'error' && file.error && (
                      <Alert variant="destructive" className="mb-3">
                        <XCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Erro:</strong> {file.error}
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {/* Success details */}
                    {file.status === 'completed' && file.analysis && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">
                            {file.transactions}
                          </p>
                          <p className="text-xs text-gray-500">Transações</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-blue-600">
                            {file.categories?.length || 0}
                          </p>
                          <p className="text-xs text-gray-500">Categorias</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-purple-600">
                            {Math.round(file.analysis.averageConfidence * 100)}%
                          </p>
                          <p className="text-xs text-gray-500">Precisão</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-orange-600">
                            {file.analysis.processingTime}s
                          </p>
                          <p className="text-xs text-gray-500">Tempo</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Estado vazio */}
        {files.length === 0 && (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum arquivo processado ainda
            </h3>
            <p className="text-gray-500 mb-6">
              Faça upload do seu primeiro extrato bancário para começar
            </p>
            <Button onClick={() => document.getElementById('fileInput')?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Selecionar Arquivo
            </Button>
          </div>
        )}
      </div>
      
      {/* ✅ Componente de debug */}
      <DebugInfo />
    </div>
  )
}


