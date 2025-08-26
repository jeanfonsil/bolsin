import { NextRequest, NextResponse } from 'next/server'
import { categorizeTransactions, analyzeCategorizationConfidence } from '@/lib/ai/categorization'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { descriptions } = body

    if (!Array.isArray(descriptions) || descriptions.length === 0) {
      return NextResponse.json(
        { error: 'Descrições das transações são obrigatórias' },
        { status: 400 }
      )
    }

    if (descriptions.length > 200) {
      return NextResponse.json(
        { error: 'Máximo de 200 transações por vez' },
        { status: 400 }
      )
    }

    console.log(`📊 API Categorização: ${descriptions.length} transações`)

    const startTime = Date.now()
    const results = await categorizeTransactions(descriptions)
    const processingTime = Date.now() - startTime

    const analysis = await analyzeCategorizationConfidence(results)

    const categoryStats = results.reduce((acc, tx) => {
      acc[tx.category] = (acc[tx.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log(`✅ Categorização concluída em ${processingTime}ms`)
    console.log(`📈 Confiança média: ${(analysis.averageConfidence * 100).toFixed(1)}%`)

    return NextResponse.json({
      success: true,
      data: {
        transactions: results,
        analysis: {
          ...analysis,
          processingTime,
          totalTransactions: results.length,
          categoryDistribution: categoryStats
        }
      }
    })

  } catch (error) {
    console.error('Erro na API de categorização:', error)
    
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor', 
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const description = searchParams.get('description')

  if (!description) {
    return NextResponse.json(
      { error: 'Parâmetro description é obrigatório' },
      { status: 400 }
    )
  }

  try {
    const results = await categorizeTransactions([description])
    return NextResponse.json({
      success: true,
      data: results[0]
    })
  } catch (error) {
    console.error('Erro na categorização única:', error)
    return NextResponse.json(
      { error: 'Erro ao categorizar transação' },
      { status: 500 }
    )
  }
}