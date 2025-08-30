import { NextRequest, NextResponse } from 'next/server'
import { getFileStore } from '@/lib/server/file-store'

export const runtime = 'nodejs'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { fileId } = await request.json()
    console.log('Processando arquivo ID:', fileId)

    if (!fileId) {
      return NextResponse.json({ success: false, error: 'ID do arquivo é obrigatório' }, { status: 400 })
    }

    const store = getFileStore()
    const fileData = store.get(fileId)

    if (!fileData) {
      return NextResponse.json(
        {
          success: false,
          error: 'Arquivo não encontrado',
          suggestion: 'Faça upload novamente',
          debug: { availableIds: Array.from(store.keys()), storeSize: store.size }
        },
        { status: 404 }
      )
    }

    if (fileData.metadata?.fileType !== 'csv') {
      return NextResponse.json(
        { success: false, error: `Tipo de arquivo não suportado: ${fileData.metadata?.fileType}` },
        { status: 400 }
      )
    }

    // MVP: processamento simulado com base em linhas
    const csvContent = fileData.buffer.toString('utf-8')
    const lines = csvContent.split('\n').filter(l => l.trim())
    const transactionCount = Math.max(0, lines.length - 1)

    const mockCategories = ['Alimentação', 'Transporte', 'Outros']
    const mockTransactions = [] as Array<{
      id: string
      date: string
      description: string
      amount: number
      type: 'debit' | 'credit'
      category: string
      aiConfidence: number
    }>

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

    return NextResponse.json({
      success: true,
      data: {
        transactions: transactionCount,
        categories: mockCategories,
        analysis: {
          averageConfidence: mockTransactions.reduce((s, t) => s + t.aiConfidence, 0) / Math.max(mockTransactions.length, 1),
          categoryDistribution: mockTransactions.reduce((acc, t) => {
            acc[t.category] = (acc[t.category] || 0) + 1
            return acc
          }, {} as Record<string, number>),
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
  const store = getFileStore()
  const { searchParams } = new URL(request.url)
  const fileId = searchParams.get('fileId')
  if (fileId) {
    const fileData = store.get(fileId)
    return NextResponse.json({ fileId, exists: !!fileData, metadata: fileData?.metadata || null })
  }
  return NextResponse.json({ success: true, message: 'Process API funcionando', debug: { filesAvailable: store.size, availableIds: Array.from(store.keys()) } })
}

