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
      
      const uploadResult = await uploadResponse.json()
      console.log('📤 Upload resultado:', uploadResult)
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Erro no upload')
      }

      const realFileId = uploadResult.data.fileId
      console.log('🆔 FileId real:', realFileId)

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

      const processResponse = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: realFileId })
      })
      
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
              analysis: processResult.data.analysis
            }
          : f
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

      const csvData = result.data.transactions as any[]

      // Gerar CSV otimizado
      const headers = Object.keys(csvData[0])
      const csvContent = [
        headers.join(','),
        ...csvData.map(row => 
          headers.map(header => {
            const value = row[header as keyof typeof row]
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`
            }
            return value
          }).join(',')
        )
      ].join('\n')

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="container mx-auto max-w-6xl">
        
        {/* Header melhorado */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard do Bolsin</h1>
              <p className="text-gray-600">Transforme seus extratos bancários em planilhas organizadas com IA</p>
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

          {/* Estatísticas rápidas */}
          {files.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <FileSpreadsheet className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-sm text-gray-600">Total Arquivos</p>
                      <p className="text-2xl font-bold">{files.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-sm text-gray-600">Processados</p>
                      <p className="text-2xl font-bold">{files.filter(f => f.status === 'completed').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-5 w-5 text-purple-500" />
                    <div>
                      <p className="text-sm text-gray-600">Transações</p>
                      <p className="text-2xl font-bold">
                        {files.reduce((sum, f) => sum + (f.transactions || 0), 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Brain className="h-5 w-5 text-indigo-500" />
                    <div>
                      <p className="text-sm text-gray-600">IA Confiança</p>
                      <p className="text-2xl font-bold">
                        {files.length > 0 
                          ? Math.round(files.reduce((sum, f) => sum + (f.analysis?.averageConfidence || 0), 0) / files.length * 100)
                          : 0}%
                      </p>
                    </div>
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
                {isProcessing ? 'Aguarde o processamento atual terminar' : 'ou clique para selecionar'}
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

        {/* Lista de arquivos melhorada */}
        {files.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Arquivos Processados</CardTitle>
              <CardDescription>
                Acompanhe o status e faça download das planilhas organizadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {files.map((file) => (
                  <div key={file.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-8 w-8 text-gray-400" />
                        <div>
                          <h3 className="font-medium text-gray-900">{file.name}</h3>
                          <p className="text-sm text-gray-500">
                            {formatFileSize(file.size)} • {file.uploadedAt.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(file.status)}
                          <span className="text-sm font-medium">{getStatusText(file.status)}</span>
                        </div>
                        
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
                    {file.status === 'completed' && (
                      <div>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span>📊 {file.transactions} transações</span>
                          <span>🏷️ {file.categories?.length} categorias</span>
                          {file.analysis && (
                            <span>🎯 {Math.round(file.analysis.averageConfidence * 100)}% confiança</span>
                          )}
                        </div>
                        
                        {file.categories && file.categories.length > 0 && (
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

        {/* Empty state melhorado */}
        {files.length === 0 && (
          <Card className="text-center py-16">
            <CardContent>
              <FileSpreadsheet className="mx-auto h-20 w-20 text-gray-400 mb-6" />
              <h3 className="text-2xl font-medium text-gray-900 mb-3">Bem-vindo ao Bolsin!</h3>
              <p className="text-gray-500 mb-8 max-w-md mx-auto">
                Transforme seus extratos bancários em planilhas organizadas automaticamente. 
                Nossa IA categoriza suas transações em segundos.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Upload className="h-6 w-6 text-blue-600" />
                  </div>
                  <h4 className="font-medium">1. Upload</h4>
                  <p className="text-sm text-gray-500">Envie seu extrato</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Brain className="h-6 w-6 text-purple-600" />
                  </div>
                  <h4 className="font-medium">2. IA Processa</h4>
                  <p className="text-sm text-gray-500">Categorização automática</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Download className="h-6 w-6 text-green-600" />
                  </div>
                  <h4 className="font-medium">3. Download</h4>
                  <p className="text-sm text-gray-500">Planilha organizada</p>
                </div>
              </div>
              <Button 
                size="lg"
                onClick={() => document.getElementById('fileInput')?.click()}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <Upload className="h-5 w-5 mr-2" />
                Começar Agora
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}


