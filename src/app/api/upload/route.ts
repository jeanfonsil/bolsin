// SUBSTITUA COMPLETAMENTE o arquivo src/app/api/upload/route.ts:

import { NextRequest, NextResponse } from 'next/server'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'text/csv', 
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]

// Store em memória (temporário para MVP)
const fileStore = new Map<string, {
  buffer: Buffer
  metadata: any
}>()

export async function POST(request: NextRequest) {
  console.log('🔄 Upload API iniciada...')
  
  try {
    console.log('1️⃣ Parseando form data...')
    const formData = await request.formData()
    
    console.log('2️⃣ Extraindo arquivo...')
    const file = formData.get('file') as File
    const userId = formData.get('userId') as string || 'anonymous'

    console.log('📊 Dados recebidos:', {
      hasFile: !!file,
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file?.size,
      userId
    })

    if (!file) {
      console.log('❌ Nenhum arquivo enviado')
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado' },
        { status: 400 }
      )
    }

    console.log('3️⃣ Validando tipo de arquivo...')
    if (!ALLOWED_TYPES.includes(file.type)) {
      console.log('❌ Tipo não permitido:', file.type)
      return NextResponse.json(
        { 
          error: 'Tipo de arquivo não suportado',
          received: file.type,
          allowedTypes: ALLOWED_TYPES 
        },
        { status: 400 }
      )
    }

    console.log('4️⃣ Validando tamanho...')
    if (file.size > MAX_FILE_SIZE) {
      console.log('❌ Arquivo muito grande:', file.size)
      return NextResponse.json(
        { 
          error: 'Arquivo muito grande',
          maxSize: MAX_FILE_SIZE,
          receivedSize: file.size
        },
        { status: 400 }
      )
    }

    console.log(`5️⃣ Upload válido: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)

    console.log('6️⃣ Processando arquivo em memória...')
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Gerar ID único
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2)
    const fileId = `${timestamp}-${randomId}`

    console.log('7️⃣ Salvando em memória...')
    
    // Armazenar em memória temporariamente
    const metadata = {
      id: fileId,
      originalName: file.name,
      fileName: `${fileId}.${getFileExtension(file.name)}`,
      fileSize: file.size,
      fileType: getFileTypeFromMime(file.type),
      uploadedAt: new Date(),
      status: 'uploaded',
      userId
    }

    // Store file data in memory
    fileStore.set(fileId, {
      buffer,
      metadata
    })

    console.log('✅ Arquivo processado em memória:', fileId)

    const responseData = {
      success: true,
      data: {
        id: fileId,
        fileName: metadata.fileName,
        originalName: file.name,
        fileSize: file.size,
        fileType: metadata.fileType,
        uploadedAt: metadata.uploadedAt,
        status: 'uploaded',
        mode: 'memory-storage'
      }
    }

    console.log('🎉 Upload concluído:', responseData)

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('❌ Erro geral no upload:', error)
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack')
    
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        details: process.env.NODE_ENV === 'development' ? {
          stack: error instanceof Error ? error.stack : undefined
        } : undefined
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  console.log('📡 GET /api/upload chamado')
  
  const { searchParams } = new URL(request.url)
  const fileId = searchParams.get('id')

  console.log('🔍 Buscando arquivo ID:', fileId)

  if (!fileId) {
    return NextResponse.json(
      { error: 'ID do arquivo é obrigatório' },
      { status: 400 }
    )
  }

  try {
    // Buscar no store em memória
    const fileData = fileStore.get(fileId)
    
    if (!fileData) {
      console.log('❌ Arquivo não encontrado:', fileId)
      return NextResponse.json(
        { error: 'Arquivo não encontrado' },
        { status: 404 }
      )
    }

    console.log('✅ Arquivo encontrado:', fileId)

    // Simular transações para download
    const mockTransactions = [
      {
        id: '1',
        description: 'UBER EATS PEDIDO 1234',
        amount: 45.90,
        category: 'Alimentação',
        confidence: 0.95,
        type: 'debit',
        date: new Date('2024-08-26')
      },
      {
        id: '2', 
        description: 'POSTO SHELL COMBUSTIVEL',
        amount: 89.50,
        category: 'Transporte',
        confidence: 0.92,
        type: 'debit',
        date: new Date('2024-08-25')
      },
      {
        id: '3',
        description: 'NETFLIX ASSINATURA',
        amount: 29.90,
        category: 'Lazer',
        confidence: 0.88,
        type: 'debit', 
        date: new Date('2024-08-24')
      }
    ]

    return NextResponse.json({
      success: true,
      data: {
        ...fileData.metadata,
        transactions: mockTransactions,
        transactionCount: mockTransactions.length
      }
    })

  } catch (error) {
    console.error('❌ Erro ao buscar status:', error)
    return NextResponse.json(
      { error: 'Erro ao verificar status' },
      { status: 500 }
    )
  }
}

function getFileTypeFromMime(mimeType: string): string {
  const mapping = {
    'application/pdf': 'pdf',
    'text/csv': 'csv',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx'
  }
  return mapping[mimeType as keyof typeof mapping] || 'unknown'
}

function getFileExtension(filename: string): string {
  return filename.split('.').pop() || 'unknown'
}