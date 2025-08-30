import { NextRequest, NextResponse } from 'next/server'
import { MonitoringService } from '@/lib/monitoring/monitoring'
import { CSVParser } from '@/lib/parsers/csv-parser'
import { categorizeTransactions } from '@/lib/ai/categorization'
import { getFileStore } from '@/lib/server/file-store'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const monitoring = MonitoringService.getInstance()

  try {
    const { fileId } = await request.json()
    if (!fileId) {
      return NextResponse.json(
        { success: false, error: 'ID do arquivo é obrigatório' },
        { status: 400 }
      )
    }

    const fileStore = getFileStore()
    const fileData = fileStore.get(fileId)

    if (!fileData) {
      return NextResponse.json(
        { success: false, error: 'Arquivo não encontrado' },
        { status: 404 }
      )
    }

    if (fileData.metadata?.fileType !== 'csv') {
      monitoring.errorProcess(fileId, 'parsing', 'Tipo de arquivo não suportado', {
        errorType: 'unsupported_type',
        fileType: fileData.metadata?.fileType
      })
      return NextResponse.json(
        { success: false, error: 'Apenas CSV é suportado no momento' },
        { status: 415 }
      )
    }

    // Parsing
    monitoring.startProcess(fileId, 'parsing', {
      fileName: fileData.metadata?.originalName,
      fileSize: fileData.metadata?.size
    })

    const csvContent = decodeBuffer(fileData.buffer)
    if (!csvContent || csvContent.length < 10) {
      monitoring.errorProcess(fileId, 'parsing', 'Conteúdo CSV vazio ou inválido', {
        errorType: 'empty_content',
        contentLength: csvContent?.length || 0
      })
      return NextResponse.json(
        { success: false, error: 'Conteúdo CSV vazio ou inválido' },
        { status: 422 }
      )
    }

    const parser = new CSVParser()
    const parseResult = await parser.parseCSV(csvContent)

    if (parseResult.transactions.length === 0) {
      monitoring.errorProcess(fileId, 'parsing', 'Nenhuma transação válida encontrada', {
        errorType: 'no_transactions',
        totalRows: parseResult.metadata.totalRows,
        errorRows: parseResult.metadata.errorRows
      })
      return NextResponse.json(
        { success: false, error: 'Nenhuma transação válida encontrada' },
        { status: 422 }
      )
    }

    monitoring.completeProcess(fileId, 'parsing', {
      transactionsFound: parseResult.transactions.length,
      totalRows: parseResult.metadata.totalRows,
      successfulRows: parseResult.metadata.successfulRows,
      errorRows: parseResult.metadata.errorRows,
      detectedBank: parseResult.metadata.detectedBank
    })

    // Categorization
    monitoring.startProcess(fileId, 'categorization', {
      transactionsToProcess: parseResult.transactions.length
    })

    const descriptions = parseResult.transactions.map(t => t.description)
    const startTime = Date.now()
    const categorized = await categorizeTransactions(descriptions)
    const processingTime = Date.now() - startTime

    const categoryStats = categorized.reduce((acc, cat) => {
      if (cat.category) acc[cat.category] = (acc[cat.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const avgConfidence = categorized.reduce((sum, cat) => sum + (cat.confidence || 0), 0) / categorized.length

    monitoring.completeProcess(fileId, 'categorization', {
      averageConfidence: avgConfidence,
      processingTime,
      categoriesFound: Object.keys(categoryStats).length,
      categoryDistribution: categoryStats
    })

    const finalTransactions = parseResult.transactions.map((transaction, index) => ({
      ...transaction,
      category: categorized[index]?.category || 'Outros',
      aiConfidence: categorized[index]?.confidence || 0.5,
      date: transaction.date instanceof Date ? transaction.date.toISOString().split('T')[0] : transaction.date
    }))

    return NextResponse.json({
      success: true,
      data: {
        fileId,
        transactions: finalTransactions.length,
        categories: Object.keys(categoryStats),
        analysis: {
          averageConfidence: avgConfidence,
          processingTime,
          categoryDistribution: categoryStats
        },
        metadata: parseResult.metadata
      }
    })
  } catch (error) {
    console.error('Erro no processamento:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Erro no processamento',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fileId = searchParams.get('fileId')

  const fileStore = getFileStore()
  if (fileId) {
    const fileData = fileStore.get(fileId)
    return NextResponse.json({ fileId, exists: !!fileData, metadata: fileData?.metadata || null })
  }
  return NextResponse.json({ message: 'Process API funcionando', filesAvailable: fileStore.size })
}

function decodeBuffer(buffer: Buffer): string {
  const utf8Text = buffer.toString('utf-8')
  const hasUtf8Artifacts = /ǟ|�'|���/.test(utf8Text)
  if (hasUtf8Artifacts) {
    const latin1Text = buffer.toString('latin1')
    const utf8ArtifactCount = (utf8Text.match(/ǟ|�'|���/g) || []).length
    const latin1ArtifactCount = (latin1Text.match(/ǟ|�'|���/g) || []).length
    return latin1ArtifactCount < utf8ArtifactCount ? latin1Text : utf8Text
  }
  return utf8Text
}

