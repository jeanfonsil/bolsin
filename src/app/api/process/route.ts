import { NextRequest, NextResponse } from 'next/server'
import { getFileStore } from '@/lib/server/file-store'
import { PDFParser } from '@/lib/parsers/pdf-parser'
import { categorizeTransactions } from '@/lib/ai/categorization'
import { structureTransactions } from '@/lib/ai/transaction-structurer'

export const runtime = 'nodejs'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { fileId } = await request.json()
    if (!fileId) {
      return NextResponse.json({ success: false, error: 'ID do arquivo é obrigatório' }, { status: 400 })
    }

    const store = getFileStore()
    const fileData = store.get(fileId)
    if (!fileData) {
      return NextResponse.json({ success: false, error: 'Arquivo não encontrado', suggestion: 'Faça upload novamente' }, { status: 404 })
    }

    const fileType = fileData.metadata?.fileType

    // PDF: parser real
    if (fileType === 'pdf') {
      const start = Date.now()
      const parser = new PDFParser()
      // Aceitar senha opcional no body
      const { password } = await request.json().catch(() => ({ password: undefined }))
      try {
        const parsed = await parser.parse(fileData.buffer, password)
      const descriptions = parsed.transactions.map(t => t.description)
      const categorized = await categorizeTransactions(descriptions)
      const structured = await structureTransactions(parsed.transactions.map(t => ({ description: t.description, amount: t.amount, type: t.type })))

      const rows = parsed.transactions.map((t, i) => ({
        id: `tx_${i + 1}`,
        date: t.date instanceof Date ? t.date.toISOString().split('T')[0] : String(t.date),
        description: t.description,
        amount: t.amount,
        type: t.type,
        category: categorized[i]?.category || 'Outros',
        aiConfidence: categorized[i]?.confidence ?? 0.5,
        channel: structured[i]?.channel || 'other',
        direction: structured[i]?.direction || 'out',
        counterparty: structured[i]?.counterparty,
        method: structured[i]?.method,
        notes: structured[i]?.notes
      }))

      const dist = rows.reduce((acc, r) => { acc[r.category] = (acc[r.category] || 0) + 1; return acc }, {} as Record<string, number>)
      const avgConf = rows.reduce((s, r) => s + (r.aiConfidence || 0), 0) / Math.max(rows.length, 1)
      // Persistir linhas processadas no store para permitir download posterior
      const updated = { ...fileData, processedRows: rows }
      const mutableStore = getFileStore()
      mutableStore.set(fileId, updated as any)

      return NextResponse.json({
        success: true,
        data: {
          transactions: rows.length,
          categories: Object.keys(dist),
          analysis: {
            averageConfidence: avgConf,
            categoryDistribution: dist,
            processingTime: Date.now() - start
          },
          rawTransactions: rows,
          metadata: {
            fileId,
            originalName: fileData.metadata.originalName,
            processedAt: new Date().toISOString(),
            linesProcessed: parsed.metadata.totalRows
          }
        }
      })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (/senha/i.test(msg) || /password/i.test(msg)) {
          return NextResponse.json({ success: false, error: 'PDF protegido por senha', requiresPassword: true }, { status: 422 })
        }
        throw e
      }
    }

    // CSV: MVP simulado
    const csvContent = fileData.buffer.toString('utf-8')
    const lines = csvContent.split('\n').filter(l => l.trim())
    const transactionCount = Math.max(0, lines.length - 1)
    const mockCategories = ['Alimentação', 'Transporte', 'Outros']
    const mockTransactions = [] as Array<{ id: string; date: string; description: string; amount: number; type: 'debit' | 'credit'; category: string; aiConfidence: number; channel?: string; direction?: string; counterparty?: string }>
    for (let i = 1; i < Math.min(lines.length, 10); i++) {
      const amount = parseFloat((Math.random() * 1000).toFixed(2))
      mockTransactions.push({
        id: `tx_${i}`,
        date: '2024-01-01',
        description: `Transação ${i} do arquivo`,
        amount,
        type: amount >= 0 ? 'credit' : 'debit',
        category: mockCategories[Math.floor(Math.random() * mockCategories.length)],
        aiConfidence: Math.random()
      })
    }
    // Enriquecer mock com estrutura heurística
    const structuredMock = await structureTransactions(mockTransactions.map(m => ({ description: m.description, amount: m.amount, type: m.type })))
    mockTransactions.forEach((m, idx) => { (m as any).channel = structuredMock[idx]?.channel; (m as any).direction = structuredMock[idx]?.direction; (m as any).counterparty = structuredMock[idx]?.counterparty })
    // Persistir mock no store também
    const updated = { ...fileData, processedRows: mockTransactions }
    getFileStore().set(fileId, updated as any)
    return NextResponse.json({
      success: true,
      data: {
        transactions: transactionCount,
        categories: mockCategories,
        analysis: {
          averageConfidence: mockTransactions.reduce((s, t) => s + t.aiConfidence, 0) / Math.max(mockTransactions.length, 1),
          categoryDistribution: mockTransactions.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + 1; return acc }, {} as Record<string, number>),
          processingTime: 2
        },
        rawTransactions: mockTransactions,
        metadata: {
          fileId,
          originalName: fileData.metadata.originalName,
          processedAt: new Date().toISOString(),
          linesProcessed: lines.length
        }
      }
    })
  } catch (error) {
    console.error('Erro no processamento:', error)
    return NextResponse.json({ success: false, error: 'Erro no processamento', message: error instanceof Error ? error.message : 'Erro desconhecido' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const store = getFileStore()
  const { searchParams } = new URL(request.url)
  const fileId = searchParams.get('fileId')
  if (fileId) {
    const fileData = store.get(fileId)
    return NextResponse.json({ fileId, exists: !!fileData, metadata: fileData?.metadata || null })
  }
  return NextResponse.json({ success: true, message: 'Process API funcionando', debug: { filesAvailable: store.size, availableIds: Array.from(store.keys()) } })
}
