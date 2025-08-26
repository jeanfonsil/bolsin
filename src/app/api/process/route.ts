import { NextRequest, NextResponse } from 'next/server'
import { categorizeTransactions } from '@/lib/ai/categorization'

export async function POST(request: NextRequest) {
  console.log('🔄 API Process iniciada...')
  
  try {
    const { fileId } = await request.json()

    if (!fileId) {
      console.log('❌ FileId não fornecido')
      return NextResponse.json(
        { error: 'ID do arquivo é obrigatório' },
        { status: 400 }
      )
    }

    console.log(`📂 Processando arquivo ID: ${fileId}`)

    // Por enquanto, não verificar no banco - apenas processar
    console.log('⚠️ Modo desenvolvimento: processando sem verificar banco')

    // Dados simulados realistas para teste
    const mockTransactions = [
      {
        date: new Date('2024-08-26'),
        description: 'UBER EATS PEDIDO 12345',
        amount: 45.90,
        type: 'debit' as const
      },
      {
        date: new Date('2024-08-25'),
        description: 'POSTO SHELL COMBUSTIVEL',
        amount: 89.50,
        type: 'debit' as const
      },
      {
        date: new Date('2024-08-24'),
        description: 'SUPERMERCADO PAO DE ACUCAR',
        amount: 127.30,
        type: 'debit' as const
      },
      {
        date: new Date('2024-08-23'),
        description: 'NETFLIX ASSINATURA MENSAL',
        amount: 29.90,
        type: 'debit' as const
      },
      {
        date: new Date('2024-08-22'),
        description: 'PIX TRANSFERENCIA JOAO SILVA',
        amount: 200.00,
        type: 'credit' as const
      },
      {
        date: new Date('2024-08-21'),
        description: 'FARMACIA DROGASIL REMEDIOS',
        amount: 67.80,
        type: 'debit' as const
      },
      {
        date: new Date('2024-08-20'),
        description: 'SHOPPING IGUATEMI ESTACIONAMENTO',
        amount: 15.00,
        type: 'debit' as const
      }
    ]

    console.log(`📊 ${mockTransactions.length} transações simuladas geradas`)

    // Categorizar com IA REAL
    console.log('🧠 Iniciando categorização IA...')
    const descriptions = mockTransactions.map(t => t.description)
    
    try {
      const categorized = await categorizeTransactions(descriptions)
      console.log('✅ Categorização IA concluída')
      console.log('📈 Primeiras categorias:', categorized.slice(0, 3).map(c => `${c.category} (${(c.confidence * 100).toFixed(1)}%)`))

      // Calcular estatísticas
      const categoryStats = categorized.reduce((acc, cat) => {
        if (cat.category) {
          acc[cat.category] = (acc[cat.category] || 0) + 1
        }
        return acc
      }, {} as Record<string, number>)

      const avgConfidence = categorized.reduce((sum, cat) => sum + (cat.confidence || 0), 0) / categorized.length

      console.log('📊 Estatísticas calculadas:')
      console.log('   - Categorias:', Object.keys(categoryStats))
      console.log('   - Distribuição:', categoryStats)
      console.log('   - Confiança média:', (avgConfidence * 100).toFixed(1) + '%')

      const responseData = {
        success: true,
        data: {
          fileId,
          transactionCount: mockTransactions.length,
          categories: Object.keys(categoryStats),
          categoryDistribution: categoryStats,
          averageConfidence: avgConfidence,
          processingTime: 2500, // Tempo simulado
          status: 'completed',
          // Dados extras para debug
          sampleTransactions: categorized.slice(0, 3),
          mode: 'development-mock'
        }
      }

      console.log('🎉 Processamento concluído com sucesso!')
      return NextResponse.json(responseData)

    } catch (aiError) {
      console.error('❌ Erro na IA:', aiError)
      
      // Fallback com categorias básicas
      const fallbackCategories = ['Alimentação', 'Transporte', 'Outros']
      const fallbackStats = {
        'Alimentação': 3,
        'Transporte': 2,
        'Outros': 2
      }

      console.log('🔄 Usando fallback categories')

      return NextResponse.json({
        success: true,
        data: {
          fileId,
          transactionCount: mockTransactions.length,
          categories: fallbackCategories,
          categoryDistribution: fallbackStats,
          averageConfidence: 0.75,
          processingTime: 1500,
          status: 'completed',
          mode: 'fallback',
          warning: 'IA indisponível - usado categorização básica'
        }
      })
    }

  } catch (error) {
    console.error('❌ Erro geral no processamento:', error)
    console.error('❌ Stack:', error instanceof Error ? error.stack : 'No stack')

    return NextResponse.json(
      {
        error: 'Erro no processamento',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        details: process.env.NODE_ENV === 'development' ? {
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        } : undefined
      },
      { status: 500 }
    )
  }
}