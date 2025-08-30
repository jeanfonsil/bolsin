import { NextRequest, NextResponse } from 'next/server'
import { MonitoringService } from '@/lib/monitoring/monitoring'
import { getFileStore } from '@/lib/server/file-store'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

const fileStore = getFileStore()

export async function POST(request: NextRequest) {
  const monitoring = MonitoringService.getInstance()
  const fileId = crypto.randomUUID()

  monitoring.startProcess(fileId, 'upload')

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      const error = 'Nenhum arquivo enviado'
      monitoring.errorProcess(fileId, 'upload', error, {
        errorType: 'validation_error',
        step: 'file_validation'
      })
      return NextResponse.json({ success: false, error }, { status: 400 })
    }

    const maxSize = 10 * 1024 * 1024 // 10MB
    const validTypes = [
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]

    if (file.size > maxSize) {
      const error = 'Arquivo muito grande. Máximo 10MB.'
      monitoring.errorProcess(fileId, 'upload', error, {
        errorType: 'size_error',
        fileSize: file.size,
        fileName: file.name
      })
      return NextResponse.json({ success: false, error }, { status: 413 })
    }

    if (!validTypes.includes(file.type)) {
      const error = 'Tipo de arquivo não suportado. Use PDF, CSV, XLS ou XLSX.'
      monitoring.errorProcess(fileId, 'upload', error, {
        errorType: 'type_error',
        fileType: file.type,
        fileName: file.name
      })
      return NextResponse.json({ success: false, error }, { status: 415 })
    }

    // Ler arquivo
    const buffer = Buffer.from(await file.arrayBuffer())

    const metadata = {
      originalName: file.name,
      fileType: getFileTypeFromMime(file.type),
      mimeType: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString()
    }

    // Salvar em memória
    fileStore.set(fileId, { buffer, metadata })

    // Backup em disco (best-effort)
    try {
      const uploadDir = path.join(process.cwd(), 'uploads')
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
      const ext = getFileExtension(file.name)
      const diskPath = path.join(uploadDir, `${fileId}.${ext}`)
      fs.writeFileSync(diskPath, buffer)
    } catch (diskError) {
      console.error('Erro ao salvar backup em disco:', diskError)
    }

    monitoring.completeProcess(fileId, 'upload', {
      fileName: file.name,
      fileSize: file.size,
      fileType: metadata.fileType,
      uploadedAt: metadata.uploadedAt
    })

    return NextResponse.json({
      success: true,
      data: {
        fileId,
        originalName: file.name,
        size: file.size,
        type: metadata.fileType,
        uploadedAt: metadata.uploadedAt,
        validation: { warnings: [] }
      }
    })
  } catch (error) {
    console.error('Erro no upload:', error)
    monitoring.errorProcess(fileId, 'upload', error instanceof Error ? error.message : 'Erro desconhecido', {
      errorType: 'upload_error',
      step: 'processing'
    })
    return NextResponse.json(
      { success: false, error: 'Erro interno no upload', message: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    return NextResponse.json({
      message: 'Upload API funcionando',
      filesInMemory: fileStore.size,
      supportedTypes: [
        'text/csv',
        'application/pdf',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ]
    })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao verificar status' }, { status: 500 })
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

