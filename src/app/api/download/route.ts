// CRIAR NOVO ARQUIVO: src/app/api/download/route.ts

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { categorizeTransactions } from '@/lib/ai/categorization'

export const runtime = 'nodejs'

// Usar o mesmo store da API upload/process
declare global {
  var fileStore: Map<string, {
    buffer: Buffer
    metadata: any
  }>
  var processedDataStore: Map<string, any>
}

if (typeof global !== 'undefined') {
  if (!global.fileStore) {
    global.fileStore = new Map()
  }
  if (!global.processedDataStore) {
    global.processedDataStore = new Map()
  }
}

const fileStore = global.fileStore
const processedDataStore = global.processedDataStore

export async function POST(request: NextRequest) {
  console.log('📥 Download API iniciada...')
  
  try {
    const { fileId } = await request.json()
    
    if (!fileId) {
      return NextResponse.json(
        { error: 'ID do arquivo é obrigatório' },
        { status: 400 }
      )
    }

    console.log('🔍 Preparando dados REAIS para download:', fileId)

    // Se não tiver cache, tentar reprocessar o arquivo
    let fileData = fileStore.get(fileId)

    // Se não houver em memória, buscar em disco
    if (!fileData) {
      const uploadDir = path.join(process.cwd(), 'uploads')
      try {
        if (fs.existsSync(uploadDir)) {
          const candidate = fs.readdirSync(uploadDir).find(fn => fn.startsWith(fileId))
          if (candidate) {
            const diskPath = path.join(uploadDir, candidate)
            const ext = candidate.split('.').pop()
            const buffer = fs.readFileSync(diskPath)
            fileData = {
              buffer,
              metadata: {
                fileType: ext === 'csv' ? 'csv' : ext === 'pdf' ? 'pdf' : 'unknown',
                fileName: candidate,
                id: fileId
              }
            }
          }
        }
      } catch (diskErr) {
        console.error('❌ Erro ao buscar arquivo em disco:', diskErr)
      }
    }

    if (fileData && fileData.metadata.fileType === 'csv') {
      try {
        const { CSVParser } = await import('@/lib/parsers/csv-parser')
        const parser = new CSVParser()
        // Decodificar buffer tentando UTF-8 e caindo para Latin-1
        const decodeBuffer = (buf: Buffer): string => {
          const utf8Text = buf.toString('utf-8')
          const looksBroken = /Ã|Â|�/.test(utf8Text)
          if (looksBroken) {
            const latinText = buf.toString('latin1')
            const latinArtifacts = (latinText.match(/Ã|Â|�/g) || []).length
            const utf8Artifacts = (utf8Text.match(/Ã|Â|�/g) || []).length
            return latinArtifacts < utf8Artifacts ? latinText : utf8Text
          }
          return utf8Text
        }
        const csvContent = decodeBuffer(fileData.buffer)
        const parseResult = await parser.parseCSV(csvContent)

        if (parseResult.transactions.length > 0) {
          console.log(`✅ Reprocessamento concluído: ${parseResult.transactions.length} transações`)
          // Categorização em tempo de download para manter "real" sem cache
          const descriptions = parseResult.transactions.map(t => t.description)
          const categorized = await categorizeTransactions(descriptions)
          const downloadData = {
            transactions: parseResult.transactions.map((t, i) => ({
              date: t.date.toISOString().split('T')[0],
              description: t.description?.normalize('NFC'),
              amount: t.amount,
              type: t.type,
              category: categorized[i]?.category || 'Outros',
              confidence: categorized[i]?.confidence ?? t.confidence,
              aiConfidence: categorized[i]?.confidence ?? t.confidence,
              originalAmount: t.originalAmount
            })),
            metadata: parseResult.metadata,
            transactionCount: parseResult.transactions.length
          }
          return NextResponse.json({ success: true, data: downloadData, source: 'reprocessed' })
        }
      } catch (parseError) {
        console.error('❌ Erro no reprocessamento:', parseError)
        return NextResponse.json({ success: false, error: 'Erro ao parsear CSV para download', message: parseError instanceof Error ? parseError.message : 'Erro desconhecido' }, { status: 422 })
      }
    }
    // Sem uso de cache aqui: download deve refletir o arquivo original
    if (!fileData) {
      return NextResponse.json({ success: false, error: 'Arquivo não encontrado' }, { status: 404 })
    }
    return NextResponse.json({ success: false, error: 'Tipo de arquivo não suportado para download' }, { status: 415 })

  } catch (error) {
    console.error('❌ Erro na API download:', error)
    return NextResponse.json(
      { 
        error: 'Erro no download',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fileId = searchParams.get('fileId')
  
  if (!fileId) {
    return NextResponse.json(
      { error: 'fileId é obrigatório' },
      { status: 400 }
    )
  }

  // Redirect para POST
  return NextResponse.json({
    message: 'Use POST para baixar dados',
    endpoint: '/api/download',
    method: 'POST',
    body: { fileId }
  })
}
