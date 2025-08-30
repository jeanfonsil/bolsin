import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getFileStore } from '@/lib/server/file-store'

export const runtime = 'nodejs'

// Store simples em memória para debug
declare global {
  var debugFileStore: Map<string, any> | undefined
}

if (!global.debugFileStore) {
  global.debugFileStore = new Map()
}

export async function POST(request: NextRequest) {
  console.log('🚨 === UPLOAD API DEBUG ===')
  
  try {
    console.log('📥 Recebendo request...')
    
    const formData = await request.formData()
    console.log('📋 FormData recebido:', Array.from(formData.entries()).map(([key, value]) => 
      [key, value instanceof File ? `File(${value.name}, ${value.size}b)` : value]
    ))
    
    const file = formData.get('file') as File | null
    console.log('📁 Arquivo extraído:', file ? {
      name: file.name,
      size: file.size,
      type: file.type
    } : 'null')

    if (!file) {
      console.error('❌ Nenhum arquivo enviado')
      const errorResponse = { success: false, error: 'Nenhum arquivo enviado' }
      console.log('📤 Retornando erro:', errorResponse)
      return NextResponse.json(errorResponse, { status: 400 })
    }

    // Validações básicas
    const maxSize = 10 * 1024 * 1024 // 10MB
    const validTypes = [
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]

    console.log('🔍 Validando arquivo...')
    console.log('📏 Tamanho:', file.size, 'vs máximo:', maxSize)
    console.log('📄 Tipo:', file.type, 'válido:', validTypes.includes(file.type))

    if (file.size > maxSize) {
      const errorResponse = { success: false, error: 'Arquivo muito grande. Máximo 10MB.' }
      console.log('📤 Retornando erro de tamanho:', errorResponse)
      return NextResponse.json(errorResponse, { status: 413 })
    }

    if (!validTypes.includes(file.type)) {
      const errorResponse = { success: false, error: 'Tipo de arquivo não suportado. Use PDF, CSV, XLS ou XLSX.' }
      console.log('📤 Retornando erro de tipo:', errorResponse)
      return NextResponse.json(errorResponse, { status: 415 })
    }

    // Gerar ID e processar arquivo
    const fileId = crypto.randomUUID()
    console.log('🆔 FileId gerado:', fileId)

    // Ler arquivo
    console.log('📖 Lendo buffer do arquivo...')
    const buffer = Buffer.from(await file.arrayBuffer())
    console.log('💾 Buffer lido:', buffer.length, 'bytes')

    const metadata = {
      originalName: file.name,
      fileType: getFileTypeFromMime(file.type),
      mimeType: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString()
    }
    console.log('📊 Metadata criado:', metadata)

    // Salvar em memória
    const store = getFileStore(); store.set(fileId, { buffer, metadata }); console.log('Arquivo salvo no store. Total de arquivos:', store.size)
    console.log('💾 Arquivo salvo no store. Total de arquivos:', global.debugFileStore!.size)

    // ✅ Construir resposta EXATA
    const responseData = {
      success: true,
      data: {
        fileId: fileId,
        originalName: file.name,
        size: file.size,
        type: metadata.fileType,
        uploadedAt: metadata.uploadedAt,
        validation: { 
          warnings: [] as string[]
        }
      }
    }

    console.log('✅ Resposta construída:', JSON.stringify(responseData, null, 2))
    console.log('🔍 responseData.success:', responseData.success)
    console.log('🔍 responseData.data:', responseData.data)
    console.log('🔍 responseData.data.fileId:', responseData.data.fileId)

    const response = NextResponse.json(responseData)
    console.log('📤 Enviando resposta...')
    
    return response

  } catch (error) {
    console.error('💥 ERRO CRÍTICO no upload:', error)
    console.error('📊 Stack trace:', error instanceof Error ? error.stack : 'No stack')
    
    const errorResponse = {
      success: false,
      error: 'Erro interno no upload',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
      debug: {
        errorType: error?.constructor?.name || 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    }
    
    console.log('📤 Retornando erro crítico:', errorResponse)
    return NextResponse.json(errorResponse, { status: 500 })
  }
}

export async function GET() {
  console.log('🔍 GET /api/upload - Health check')
  
  const healthData = {
    success: true,
    message: 'Upload API funcionando',
    debug: {
      filesInMemory: getFileStore().size,
      supportedTypes: [
        'text/csv',
        'application/pdf',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ],
      timestamp: new Date().toISOString()
    }
  }
  
  console.log('📤 Health check response:', healthData)
  return NextResponse.json(healthData)
}

function getFileTypeFromMime(mimeType: string): string {
  const mapping = {
    'application/pdf': 'pdf',
    'text/csv': 'csv',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx'
  }
  const result = mapping[mimeType as keyof typeof mapping] || 'unknown'
  console.log('🔄 Conversão MIME:', mimeType, '->', result)
  return result
}
