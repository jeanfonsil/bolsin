import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'text/csv', 
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]

// 🔥 USAR STORE GLOBAL (mesmo que process/route.ts)
declare global {
  var fileStore: Map<string, {
    buffer: Buffer
    metadata: any
  }>
}

if (typeof global !== 'undefined') {
  if (!global.fileStore) {
    global.fileStore = new Map()
  }
}

const fileStore = global.fileStore // 🔥 USAR STORE GLOBAL

export async function POST(request: NextRequest) {
  console.log('🔄 Upload API iniciada...')
  
  try {
    console.log('1️⃣ Parseando form data...')
    const formData = await request.formData()
    
    console.log('2️⃣ Extraindo arquivo...')
    const file = formData.get('file') as File
    const userId = formData.get('userId') as string || 'anonymous'

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

    // Gerar ID único DETERMINÍSTICO
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 15)
    const fileId = `${timestamp}-${randomId}`
    
    console.log('🆔 ID gerado:', fileId)

    // 🔥 Salvar arquivo original como string para CSV
    let originalContent = null
    if (getFileTypeFromMime(file.type) === 'csv') {
      originalContent = buffer.toString('utf-8')
      console.log('📄 Conteúdo CSV salvo:', originalContent.length, 'caracteres')
      // 🔍 Preview do conteúdo para debug
      console.log('📄 Preview:', originalContent.substring(0, 200) + '...')
    }

    console.log('7️⃣ Salvando em memória GLOBAL e em DISCO...')
    
    // Persistir em disco (dev / node runtime)
    try {
      const uploadDir = path.join(process.cwd(), 'uploads')
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true })
      }
      const ext = getFileExtension(file.name)
      const diskFileName = `${fileId}.${ext}`
      const diskPath = path.join(uploadDir, diskFileName)
      fs.writeFileSync(diskPath, buffer)
      console.log('💾 Arquivo salvo em disco:', diskPath)
    } catch (diskErr) {
      console.error('❌ Falha ao salvar arquivo em disco:', diskErr)
    }
    
    const metadata = {
      id: fileId,
      originalName: file.name,
      fileName: `${fileId}.${getFileExtension(file.name)}`,
      fileSize: file.size,
      fileType: getFileTypeFromMime(file.type),
      uploadedAt: new Date(),
      status: 'uploaded',
      userId,
      originalContent // 🔥 SALVAR conteúdo original
    }

    // 🔥 Store file data in GLOBAL memory
    fileStore.set(fileId, {
      buffer,
      metadata
    })

    console.log('✅ Arquivo salvo no store GLOBAL')
    console.log('🗂️ Store agora tem', fileStore.size, 'arquivos')
    console.log('🔑 IDs no store:', Array.from(fileStore.keys()))

    const responseData = {
      success: true,
      data: {
        id: fileId, // 🔥 RETORNAR ID CORRETO
        fileName: metadata.fileName,
        originalName: file.name,
        fileSize: file.size,
        fileType: metadata.fileType,
        uploadedAt: metadata.uploadedAt,
        status: 'uploaded',
        mode: 'global-memory-storage'
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
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}

// Resto das funções iguais...
export async function GET(request: NextRequest) {
  console.log('📡 GET /api/upload chamado')
  
  const { searchParams } = new URL(request.url)
  const fileId = searchParams.get('id')

  if (!fileId) {
    return NextResponse.json(
      { error: 'ID do arquivo é obrigatório' },
      { status: 400 }
    )
  }

  try {
    // 🔥 Buscar no store GLOBAL
    const fileData = fileStore.get(fileId)
    
    if (!fileData) {
      console.log('❌ Arquivo não encontrado:', fileId)
      return NextResponse.json(
        { error: 'Arquivo não encontrado' },
        { status: 404 }
      )
    }

    console.log('✅ Arquivo encontrado:', fileId)

    return NextResponse.json({
      success: true,
      data: {
        ...fileData.metadata,
        hasOriginal: !!fileData.metadata.originalContent
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
