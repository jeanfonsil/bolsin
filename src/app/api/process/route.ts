import { NextRequest, NextResponse } from 'next/server'
import { MonitoringService } from '@/lib/monitoring/monitoring'
import { categorizeTransactions } from '@/lib/ai/categorization'
import { CSVParser } from '@/lib/parsers/csv-parser'

export const runtime = 'nodejs'

// Store em memória
declare global {
  var fileStore: Map<string, {
    buffer: Buffer
    metadata: any
  }>
}

const fileStore = global.fileStore

export async function POST(request: NextRequest): Promise<NextResponse> {
  const monitoring = MonitoringService.getInstance()
  
  console.log('⚙️ Process API iniciada com monitoramento...')
  
  try {
    const { fileId } = await request.json()
    
    if (!fileId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'ID do arquivo é obrigatório' 
        },
        { status: 400 }
      )
    }

    console.log(`📂 Processando arquivo: ${fileId}`)

    // Buscar arquivo no store
    const fileData = fileStore.get(fileId)
    if (!fileData) {
      monitoring.errorProcess(fileId, 'parsing', 'Arquivo não encontrado no store', {
        errorType: 'file_not_found',
        step: 'file_retrieval'
      })
      
      return NextResponse.json({
        success: false,
        error: 'Arquivo não encontrado',
        suggestion: 'Faça upload novamente'
      }, { status: 404 })
    }

    console.log(`✅ Arquivo encontrado: ${fileData.metadata?.originalName}`)

    // Verificar tipo de arquivo
    if (fileData.metadata?.fileType !== 'csv') {
      monitoring.errorProcess(fileId, 'parsing', 'Tipo de arquivo não suportado', {
        errorType: 'unsupported_type',
        fileType: fileData.metadata?.fileType
      })
      
      return NextResponse.json({
        success: false,
        error: 'Apenas arquivos CSV são suportados no momento',
        fileType: fileData.metadata?.fileType
      }, { status: 415 })
    }

    // ETAPA 1: PARSING
    monitoring.startProcess(fileId, 'parsing', {
      fileName: fileData.metadata?.originalName,
      fileSize: fileData.metadata?.size
    })
    
    console.log('🔧 Iniciando parsing CSV...')
    
    // Decodificar buffer
    const csvContent = decodeBuffer(fileData.buffer)
    console.log(`📄 CSV: ${csvContent.length} chars, ${csvContent.split('\n').length} linhas`)

    if (!csvContent || csvContent.length < 10) {
      monitoring.errorProcess(fileId, 'parsing', 'Conteúdo CSV vazio ou inválido', {
        errorType: 'empty_content',
        contentLength: csvContent?.length || 0
      })
      throw new Error('Conteúdo CSV vazio ou inválido')
    }

    // Parser
    const parser = new CSVParser()
    const parseResult = await parser.parseCSV(csvContent)
    
    console.log(`📊 Parsing: ${parseResult.transactions.length} transações encontradas`)
    
    if (parseResult.transactions.length === 0) {
      monitoring.errorProcess(fileId, 'parsing', 'Nenhuma transação válida encontrada', {
        errorType: 'no_transactions',
        totalRows: parseResult.metadata.totalRows,
        errorRows: parseResult.metadata.errorRows
      })
      throw new Error('Nenhuma transação válida encontrada no arquivo')
    }

    // Marcar parsing como sucesso
    monitoring.completeProcess(fileId, 'parsing', {
      transactionsFound: parseResult.transactions.length,
      totalRows: parseResult.metadata.totalRows,
      successfulRows: parseResult.metadata.successfulRows,
      errorRows: parseResult.metadata.errorRows,
      detectedBank: parseResult.metadata.detectedBank
    })

    // ETAPA 2: CATEGORIZAÇÃO
    monitoring.startProcess(fileId, 'categorization', {
      transactionsToProcess: parseResult.transactions.length
    })
    
    console.log('🧠 Categorizando com IA...')
    const descriptions = parseResult.transactions.map(t => t.description)
    
    const startTime = Date.now()
    const categorized = await categorizeTransactions(descriptions)
    const processingTime = Date.now() - startTime
    
    console.log(`✅ Categorização concluída em ${processingTime}ms`)

    // Calcular estatísticas
    const categoryStats = categorized.reduce((acc, cat) => {
      if (cat.category) {
        acc[cat.category] = (acc[cat.category] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)

    const avgConfidence = categorized.reduce((sum, cat) => 
      sum + (cat.confidence || 0), 0
    ) / categorized.length

    // Marcar categorização como sucesso
    monitoring.completeProcess(fileId, 'categorization', {
      averageConfidence: avgConfidence,
      processingTime,
      categoriesFound: Object.keys(categoryStats).length,
      categoryDistribution: categoryStats
    })

    // Dados finais
    const finalTransactions = parseResult.transactions.map((transaction, index) => ({
      ...transaction,
      category: categorized[index]?.category || 'Outros',
      aiConfidence: categorized[index]?.confidence || 0.5,
      date: transaction.date instanceof Date 
        ? transaction.date.toISOString().split('T')[0]
        : transaction.date
    }))

    console.log('🎉 Processamento concluído!')

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
    console.error('❌ Erro no processamento:', error)
    
    const { fileId } = await request.json().catch(() => ({ fileId: 'unknown' }))
    monitoring.errorProcess(fileId, 'parsing', error instanceof Error ? error.message : 'Erro desconhecido', {
      errorType: 'processing_error',
      step: 'general_processing'
    })
    
    return NextResponse.json({
      success: false,
      error: 'Erro no processamento',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}

// Função para decodificar buffer
function decodeBuffer(buffer: Buffer): string {
  const utf8Text = buffer.toString('utf-8')
  
  // Heurística: se tem artefatos de má decodificação, tentar latin1
  const hasUtf8Artifacts = /Ã|Â|�/.test(utf8Text)
  
  if (hasUtf8Artifacts) {
    const latin1Text = buffer.toString('latin1')
    
    // Comparar quantidade de artefatos
    const utf8ArtifactCount = (utf8Text.match(/Ã|Â|�/g) || []).length
    const latin1ArtifactCount = (latin1Text.match(/Ã|Â|�/g) || []).length
    
    // Escolher o que tem menos artefatos
    return latin1ArtifactCount < utf8ArtifactCount ? latin1Text : utf8Text
  }
  
  return utf8Text
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fileId = searchParams.get('fileId')
  
  if (fileId) {
    const fileData = fileStore.get(fileId)
    return NextResponse.json({
      fileId,
      exists: !!fileData,
      metadata: fileData?.metadata || null
    })
  }
  
  return NextResponse.json({
    message: 'Process API funcionando',
    filesAvailable: fileStore.size
  })
}