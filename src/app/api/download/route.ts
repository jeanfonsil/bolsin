import { NextRequest, NextResponse } from 'next/server'
import { MonitoringService } from '@/lib/monitoring/monitoring'
import { categorizeTransactions } from '@/lib/ai/categorization'
import { CSVParser } from '@/lib/parsers/csv-parser'
import { getFileStore } from '@/lib/server/file-store'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const monitoring = MonitoringService.getInstance()
  const fileStore = getFileStore()

  try {
    const { fileId } = await request.json()
    if (!fileId) {
      return NextResponse.json({ error: 'ID do arquivo é obrigatório' }, { status: 400 })
    }

    monitoring.startProcess(fileId, 'download', { timestamp: new Date().toISOString() })

    const fileData = fileStore.get(fileId)
    // Se já temos dados processados em memória (PDF ou CSV), usar diretamente
    const dataAny: any = fileData as any
    if (dataAny && Array.isArray(dataAny.processedRows) && dataAny.processedRows.length > 0) {
      const formattedTransactions = dataAny.processedRows.map((t: any, index: number) => ({
        ID: index + 1,
        Data: formatDateForDownload(t.date),
        Descrição: cleanDescription(t.description),
        Valor: formatCurrency(t.amount),
        Tipo: t.type === 'debit' ? 'Débito' : 'Crédito',
        Categoria: t.category || 'Outros',
        'Confiança IA': formatConfidence(t.aiConfidence ?? 0)
      }))
      monitoring.completeProcess(fileId, 'download', {
        transactionsDownloaded: formattedTransactions.length,
        fileName: dataAny.metadata?.originalName,
        source: 'processedRows'
      })
      return NextResponse.json({
        success: true,
        data: {
          transactions: formattedTransactions,
          metadata: {
            totalTransactions: formattedTransactions.length,
            fileId,
            generatedAt: new Date().toISOString()
          }
        },
        source: 'processedRows'
      })
    }
    if (!fileData || fileData.metadata?.fileType !== 'csv') {
      monitoring.errorProcess(fileId, 'download', 'Arquivo não encontrado ou tipo inválido', {
        errorType: 'file_not_found',
        hasFile: !!fileData,
        fileType: fileData?.metadata?.fileType || 'unknown'
      })
      return NextResponse.json(
        { success: false, error: 'Arquivo não encontrado ou não processado', suggestion: 'Execute upload e processamento primeiro' },
        { status: 404 }
      )
    }

    const csvContent = decodeBuffer(fileData.buffer)
    const parser = new CSVParser()
    const parseResult = await parser.parseCSV(csvContent)

    if (parseResult.transactions.length === 0) {
      monitoring.errorProcess(fileId, 'download', 'Nenhuma transação encontrada no reprocessamento', {
        errorType: 'no_transactions_reprocess'
      })
      return NextResponse.json({ success: false, error: 'Nenhuma transação encontrada para download' }, { status: 422 })
    }

    const descriptions = parseResult.transactions.map(t => t.description)
    const categorized = await categorizeTransactions(descriptions)

    const formattedTransactions = parseResult.transactions.map((transaction, index) => ({
      ID: index + 1,
      Data: formatDateForDownload(transaction.date),
      Descrição: cleanDescription(transaction.description),
      Valor: formatCurrency(transaction.amount),
      Tipo: transaction.type === 'debit' ? 'Débito' : 'Crédito',
      Categoria: categorized[index]?.category || 'Outros',
      'Confiança IA': formatConfidence(categorized[index]?.confidence || 0)
    }))

    monitoring.completeProcess(fileId, 'download', {
      transactionsDownloaded: formattedTransactions.length,
      fileName: fileData.metadata.originalName,
      source: 'reprocessed'
    })

    return NextResponse.json({
      success: true,
      data: {
        transactions: formattedTransactions,
        metadata: {
          totalTransactions: formattedTransactions.length,
          fileId,
          generatedAt: new Date().toISOString()
        }
      },
      source: 'reprocessed'
    })
  } catch (error) {
    console.error('Erro na API download:', error)
    const { fileId } = await request.json().catch(() => ({ fileId: 'unknown' }))
    MonitoringService.getInstance().errorProcess(fileId, 'download', error instanceof Error ? error.message : 'Erro desconhecido', {
      errorType: 'download_error'
    })
    return NextResponse.json({ success: false, error: 'Erro no download', message: error instanceof Error ? error.message : 'Erro desconhecido' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fileId = searchParams.get('fileId')
  if (!fileId) {
    return NextResponse.json({ error: 'fileId é obrigatório' }, { status: 400 })
  }
  return NextResponse.json({ message: 'Use POST para baixar dados', endpoint: '/api/download', method: 'POST', body: { fileId } })
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

function formatDateForDownload(dateInput: any): string {
  if (!dateInput) return ''
  let date: Date
  if (typeof dateInput === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      const [year, month, day] = dateInput.split('-').map(Number)
      date = new Date(year, month - 1, day)
    } else {
      date = new Date(dateInput)
    }
  } else if (dateInput instanceof Date) {
    date = dateInput
  } else {
    return String(dateInput)
  }
  if (isNaN(date.getTime())) return String(dateInput)
  return date.toLocaleDateString('pt-BR')
}

function cleanDescription(description: string): string {
  if (!description) return ''
  return description.trim().normalize('NFC').replace(/\s+/g, ' ').slice(0, 100)
}

function formatCurrency(amount: number): string {
  if (typeof amount !== 'number' || isNaN(amount)) return 'R$ 0,00'
  return `R$ ${Math.abs(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatConfidence(confidence: number): string {
  if (typeof confidence !== 'number' || isNaN(confidence)) return '0%'
  return `${(confidence * 100).toFixed(1)}%`
}
