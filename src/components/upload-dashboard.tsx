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
}

export default function UploadDashboard() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [dragActive, setDragActive] = useState(false)

  // Simular processamento de arquivo
  const processFile = useCallback((file: File) => {
    const newFile: UploadedFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'uploading',
      progress: 0,
      uploadedAt: new Date()
    }

    setFiles(prev => [newFile, ...prev])

    // Simular upload
    const uploadInterval = setInterval(() => {
      setFiles(prev => prev.map(f => {
        if (f.id === newFile.id && f.status === 'uploading') {
          const newProgress = Math.min(f.progress + Math.random() * 30, 100)
          if (newProgress >= 100) {
            clearInterval(uploadInterval)
            
            // Simular processamento da IA
            setTimeout(() => {
              setFiles(prev => prev.map(f => 
                f.id === newFile.id 
                  ? { ...f, status: 'processing', progress: 0 }
                  : f
              ))

              const processInterval = setInterval(() => {
                setFiles(prev => prev.map(f => {
                  if (f.id === newFile.id && f.status === 'processing') {
                    const newProgress = Math.min(f.progress + Math.random() * 25, 100)
                    if (newProgress >= 100) {
                      clearInterval(processInterval)
                      return {
                        ...f,
                        status: 'completed',
                        progress: 100,
                        transactions: Math.floor(Math.random() * 200) + 50,
                        categories: ['Alimentação', 'Transporte', 'Moradia', 'Lazer']
                      }
                    }
                    return { ...f, progress: newProgress }
                  }
                  return f
                }))
              }, 300)
            }, 1000)
          }
          return { ...f, progress: newProgress }
        }
        return f
      }))
    }, 200)
  }, [])

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
    
    return validTypes.includes(file.type) && file.size <= maxSize
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
                              <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700">
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
    </div>
  )
}