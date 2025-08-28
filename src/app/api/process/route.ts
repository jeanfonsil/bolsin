import { NextRequest, NextResponse } from 'next/server'
import { categorizeTransactions } from '@/lib/ai/categorization'
import { CSVParser } from '@/lib/parsers/csv-parser'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

// Store em memória para acessar arquivos
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('🔄 Process API iniciada com PARSER REAL...')
  console.log('🗂️ fileStore atual tem', fileStore.size, 'arquivos')
  
  // Debug: Listar todos os IDs no store
  const storeKeys = Array.from(fileStore.keys())
  console.log('🔑 IDs no fileStore:', storeKeys)
  
  try {
    const { fileId } = await request.json()
    
    console.log('📂 FileId recebido:', fileId)
    console.log('🔍 Tipo do fileId:', typeof fileId)

    if (!fileId) {
      console.log('❌ FileId não fornecido')
      return NextResponse.json(
        { error: 'ID do arquivo é obrigatório' },
        { status: 400 }
      )
    }

    // Buscar arquivo no store em memória
    let fileData = fileStore.get(fileId)
    let diskPath: string | null = null
    let diskExt: string | null = null

    // Se não estiver na memória, tentar localizar em DISCO
    if (!fileData) {
      const uploadDir = path.join(process.cwd(), 'uploads')
      try {
        if (fs.existsSync(uploadDir)) {
          const candidate = fs.readdirSync(uploadDir).find(fn => fn.startsWith(fileId))
          if (candidate) {
            diskPath = path.join(uploadDir, candidate)
            diskExt = candidate.split('.').pop() || null
            console.log('📁 Arquivo encontrado em DISCO:', diskPath)
            const buffer = fs.readFileSync(diskPath)
            fileData = {
              buffer,
              metadata: {
                originalName: candidate,
                fileType: (diskExt === 'csv' ? 'csv' : diskExt === 'pdf' ? 'pdf' : 'unknown'),
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

    // Se ainda não tiver, reportar erro claro
    if (!fileData) {
      console.log('❌ Arquivo não encontrado nem em memória nem em disco')
      return NextResponse.json({
        success: false,
        error: 'Arquivo não encontrado para processamento',
        debug: {
          requestedId: fileId,
          availableIds: storeKeys,
          uploadDir: path.join(process.cwd(), 'uploads')
        }
      }, { status: 404 })
    }
    // Já garantimos acima que existe, então não repetir verificação

    console.log('✅ Arquivo encontrado:', fileData.metadata?.originalName)
    console.log('📊 Tipo de arquivo:', fileData.metadata?.fileType)
    console.log('📏 Tamanho do buffer:', fileData.buffer?.length)

    // Determinar tipo de processamento
    if (fileData.metadata?.fileType === 'csv') {
      return await processCSVFile(fileId, fileData)
    } else if (fileData.metadata?.fileType === 'pdf') {
      console.log('⚠️ PDF parsing não implementado')
      return NextResponse.json({ success: false, error: 'PDF não suportado no momento' }, { status: 415 })
    } else {
      console.log('⚠️ Tipo de arquivo não suportado')
      return NextResponse.json({ success: false, error: 'Tipo de arquivo não suportado' }, { status: 415 })
    }

  } catch (error) {
    console.error('❌ Erro geral no processamento:', error)
    console.error('❌ Stack:', error instanceof Error ? error.stack : 'No stack')
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Erro no processamento',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

async function processCSVFile(fileId: string, fileData: any): Promise<NextResponse> {
  console.log('🚨 === DEBUG PROCESSAMENTO CSV ===')
  console.log('📊 FileId:', fileId)
  console.log('📂 FileData existe:', !!fileData)
  console.log('📂 Buffer existe:', !!fileData?.buffer)
  console.log('📂 Buffer length:', fileData?.buffer?.length)
  console.log('📊 Metadata:', JSON.stringify(fileData?.metadata, null, 2))
  
  // Decodificar buffer tentando UTF-8 e caindo para Latin-1 (Windows-1252)
  const decodeBuffer = (buf: Buffer): string => {
    const utf8Text = buf.toString('utf-8')
    // Heurística simples: presença de artefatos comuns de má decodificação
    const looksBroken = /Ã|Â|�/.test(utf8Text)
    if (looksBroken) {
      const latinText = buf.toString('latin1')
      // Preferir latin1 se parecer mais legível (menos artefatos)
      const latinArtifacts = (latinText.match(/Ã|Â|�/g) || []).length
      const utf8Artifacts = (utf8Text.match(/Ã|Â|�/g) || []).length
      return latinArtifacts < utf8Artifacts ? latinText : utf8Text
    }
    return utf8Text
  }

  try {
    // Converter buffer para string com detecção simples de encoding
    const csvContent = decodeBuffer(fileData.buffer)
    console.log('🚨 CONTEÚDO CSV REAL:')
    console.log('📄 Tamanho:', csvContent.length, 'caracteres')
    console.log('📄 Primeiras 500 chars:', csvContent.substring(0, 500))
    console.log('📄 Linhas totais:', csvContent.split('\n').length)
    console.log('📄 Header linha:', csvContent.split('\n')[0])
    
    // Parar aqui para ver se o conteúdo está correto
    if (!csvContent || csvContent.length < 10) {
      console.log('❌ CONTEÚDO CSV VAZIO OU INVÁLIDO!')
      throw new Error('Conteúdo CSV vazio')
    }
    
    // Inicializar parser
    const parser = new CSVParser()
    
    // Parsear CSV
    console.log('🔧 Iniciando parsing REAL...')
    const parseResult = await parser.parseCSV(csvContent)
    
    console.log('🚨 RESULTADO DO PARSER:')
    console.log('📊 Total transações parseadas:', parseResult.transactions.length)
    console.log('📊 Primeira transação:', JSON.stringify(parseResult.transactions[0], null, 2))
    console.log('📊 Todas as transações:')
    parseResult.transactions.forEach((t, i) => {
      console.log(`   [${i}]: ${t.date.toISOString().split('T')[0]} | ${t.description} | ${t.amount}`)
    })
    
    console.log(`✅ Parsing concluído:`)
    console.log(`   - Total linhas: ${parseResult.metadata.totalRows}`)
    console.log(`   - Sucessos: ${parseResult.metadata.successfulRows}`)
    console.log(`   - Erros: ${parseResult.metadata.errorRows}`)
    console.log(`   - Banco detectado: ${parseResult.metadata.detectedBank}`)
    
    if (parseResult.transactions.length === 0) {
      console.log('❌ NENHUMA TRANSAÇÃO ENCONTRADA APÓS PARSING!')
      throw new Error('Nenhuma transação válida encontrada no arquivo')
    }

    // Verificar se a IA está sendo chamada
    console.log('🧠 Categorizando transações com IA...')
    const descriptions = parseResult.transactions.map(t => t.description)
    console.log('🧠 Descrições para IA:', descriptions)
    
    try {
      const categorized = await categorizeTransactions(descriptions)
      console.log('🚨 RESULTADO DA IA:', categorized)
      
      // Definir finalTransactions corretamente
      const finalTransactions = parseResult.transactions.map((transaction, index) => ({
        ...transaction,
        category: categorized[index]?.category || 'Outros',
        aiConfidence: categorized[index]?.confidence || 0.5
      }))

      console.log('🚨 TRANSAÇÕES FINAIS COM IA:')
      finalTransactions.forEach((t, i) => {
        console.log(`   [${i}]: ${t.date.toISOString().split('T')[0]} | ${t.description} | ${t.amount} | ${t.category}`)
      })

      // Calcular estatísticas
      const categoryStats = categorized.reduce((acc, cat) => {
        if (cat.category) {
          acc[cat.category] = (acc[cat.category] || 0) + 1
        }
        return acc
      }, {} as Record<string, number>)

      const avgConfidence = categorized.reduce((sum, cat) => sum + (cat.confidence || 0), 0) / categorized.length

      console.log('🎉 Processamento REAL concluído com sucesso!')

      // Salvar dados processados completos
      processedDataStore.set(fileId, {
        transactions: finalTransactions,
        metadata: parseResult.metadata,
        transactionCount: finalTransactions.length,
        categoryStats,
        avgConfidence,
        processingTime: Date.now(),
        source: 'real-csv-parser'
      })
      
      console.log('💾 Dados processados REAIS salvos:', finalTransactions.length)

      return NextResponse.json({
        success: true,
        data: {
          fileId,
          transactionCount: finalTransactions.length,
          categories: Object.keys(categoryStats),
          categoryDistribution: categoryStats,
          averageConfidence: avgConfidence,
          processingTime: Date.now(),
          status: 'completed',
          mode: 'real-csv-parser',
          metadata: {
            parsingErrors: parseResult.metadata.errors,
            parsingWarnings: parseResult.metadata.warnings,
            detectedBank: parseResult.metadata.detectedBank,
            successRate: (parseResult.metadata.successfulRows / parseResult.metadata.totalRows * 100).toFixed(1) + '%'
          },
          // Incluir TODAS as transações, não apenas 3
          sampleTransactions: finalTransactions.map(t => ({
            date: t.date.toISOString().split('T')[0],
            description: t.description,
            amount: t.amount,
            type: t.type,
            category: t.category,
            confidence: t.aiConfidence
          }))
        }
      })

    } catch (aiError) {
      console.error('🚨 ERRO NA IA:', aiError)
      
      // Usar parseResult.transactions quando IA falha
      const basicTransactions = parseResult.transactions.map(t => ({
        ...t,
        category: 'Outros',
        aiConfidence: 0.5
      }))

      console.log('🚨 TRANSAÇÕES SEM IA:', basicTransactions.length)

      // Salvar dados mesmo sem IA
      processedDataStore.set(fileId, {
        transactions: basicTransactions,
        metadata: parseResult.metadata,
        transactionCount: basicTransactions.length,
        categoryStats: { 'Outros': basicTransactions.length },
        avgConfidence: 0.5,
        processingTime: Date.now(),
        source: 'real-csv-parser-no-ai'
      })

      return NextResponse.json({
        success: true,
        data: {
          fileId,
          transactionCount: basicTransactions.length,
          categories: ['Outros'],
          categoryDistribution: { 'Outros': basicTransactions.length },
          averageConfidence: 0.5,
          processingTime: Date.now(),
          status: 'completed',
          mode: 'real-csv-parser-no-ai',
          warning: 'IA indisponível, categorização básica aplicada',
          // Incluir todas as transações mesmo sem IA
          sampleTransactions: basicTransactions.map(t => ({
            date: t.date.toISOString().split('T')[0],
            description: t.description,
            amount: t.amount,
            type: t.type,
            category: t.category,
            confidence: t.aiConfidence
          }))
        }
      })
    }

  } catch (parseError) {
    console.log('🚨 ERRO NO PARSING:', parseError)
    return NextResponse.json({ success: false, error: 'Erro ao parsear CSV', message: parseError instanceof Error ? parseError.message : 'Erro desconhecido' }, { status: 422 })
  }
}

// Health check endpoint
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Process API com CSV Parser Real funcionando',
    features: {
      csvParser: true,
      pdfParser: false,
      aiCategorization: !!process.env.OPENAI_API_KEY
    }
  })
}
