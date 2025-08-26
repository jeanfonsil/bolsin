// SUBSTITUA o arquivo src/app/api/upload/route.ts por esta versão com debug:

import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'text/csv', 
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]
const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

async function ensureUploadDir() {
  try {
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true })
      console.log('📁 Diretório de upload criado:', UPLOAD_DIR)
    } else {
      console.log('📁 Diretório de upload já existe:', UPLOAD_DIR)
    }
  } catch (error) {
    console.error('❌ Erro ao criar diretório:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  console.log('🔄 Upload API iniciada...')
  
  try {
    console.log('1️⃣ Verificando diretório de upload...')
    await ensureUploadDir()

    console.log('2️⃣ Parseando form data...')
    const formData = await request.formData()
    
    console.log('3️⃣ Extraindo arquivo e userId...')
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

    console.log('4️⃣ Validando tipo de arquivo...')
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

    console.log('5️⃣ Validando tamanho...')
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

    console.log(`6️⃣ Upload válido: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)

    console.log('7️⃣ Gerando nome único...')
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2)
    const fileExtension = path.extname(file.name)
    const uniqueFileName = `${timestamp}-${randomId}${fileExtension}`
    const filePath = path.join(UPLOAD_DIR, uniqueFileName)

    console.log('📁 Caminho do arquivo:', filePath)

    console.log('8️⃣ Convertendo para buffer...')
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    console.log('9️⃣ Salvando arquivo...')
    await writeFile(filePath, buffer)
    console.log('✅ Arquivo salvo com sucesso!')

    // 🔟 Por enquanto, não salvar no banco - apenas retornar dados mock
    console.log('⚠️ Modo desenvolvimento: não salvando no banco')
    
    const mockId = `mock-${timestamp}-${randomId}`
    
    const responseData = {
      success: true,
      data: {
        id: mockId,
        fileName: uniqueFileName,
        originalName: file.name,
        fileSize: file.size,
        fileType: getFileTypeFromMime(file.type),
        uploadedAt: new Date(),
        status: 'uploaded',
        mode: 'development-mock'
      }
    }

    console.log('🎉 Upload concluído com sucesso! Resposta:', responseData)

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('❌ Erro geral no upload:', error)
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack')
    
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        details: process.env.NODE_ENV === 'development' ? error : undefined
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
    const bankExtract = await prisma.bankExtract.findUnique({
      where: { id: fileId },
      include: {
        transactions: {
          select: {
            id: true,
            description: true,
            amount: true,
            category: true,
            confidence: true,
            type: true,
            date: true
          }
        }
      }
    })

    if (!bankExtract) {
      console.log('❌ Arquivo não encontrado:', fileId)
      return NextResponse.json(
        { error: 'Arquivo não encontrado' },
        { status: 404 }
      )
    }

    console.log('✅ Arquivo encontrado:', bankExtract.id)

    return NextResponse.json({
      success: true,
      data: {
        ...bankExtract,
        transactionCount: bankExtract.transactions.length
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