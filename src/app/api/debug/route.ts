import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  console.log('🔍 === DEBUG API ===')
  
  try {
    // Verificar stores disponíveis
    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      stores: {
        debugFileStore: {
          exists: !!global.debugFileStore,
          size: global.debugFileStore?.size || 0,
          files: global.debugFileStore ? Array.from(global.debugFileStore.entries()).map(([id, data]) => ({
            id,
            name: data.metadata?.originalName || 'unknown',
            size: data.metadata?.size || 0,
            type: data.metadata?.fileType || 'unknown',
            uploadedAt: data.metadata?.uploadedAt || 'unknown'
          })) : []
        }
      },
      memory: {
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`,
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`
      },
      process: {
        uptime: `${Math.round(process.uptime())} seconds`,
        pid: process.pid,
        platform: process.platform,
        version: process.version
      }
    }

    console.log('📊 Debug info:', debugInfo)
    return NextResponse.json(debugInfo)

  } catch (error) {
    console.error('❌ Erro no debug:', error)
    return NextResponse.json({
      error: 'Erro ao obter informações de debug',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()
    console.log('🔧 Debug action:', action)

    switch (action) {
      case 'clear_stores':
        if (global.debugFileStore) {
          global.debugFileStore.clear()
        }
        console.log('🗑️ Stores limpos')
        return NextResponse.json({ success: true, message: 'Stores limpos' })

      case 'create_test_file':
        if (!global.debugFileStore) {
          global.debugFileStore = new Map()
        }
        
        const testId = 'test-' + Date.now()
        const testData = {
          buffer: Buffer.from('data,descricao,valor\n01/01/2024,TESTE,100.50'),
          metadata: {
            originalName: 'teste-debug.csv',
            fileType: 'csv',
            size: 100,
            uploadedAt: new Date().toISOString()
          }
        }
        
        global.debugFileStore.set(testId, testData)
        console.log('✅ Arquivo de teste criado:', testId)
        
        return NextResponse.json({ 
          success: true, 
          message: 'Arquivo de teste criado',
          fileId: testId
        })

      default:
        return NextResponse.json({
          error: 'Ação não reconhecida',
          availableActions: ['clear_stores', 'create_test_file']
        }, { status: 400 })
    }

  } catch (error) {
    console.error('❌ Erro na ação de debug:', error)
    return NextResponse.json({
      error: 'Erro ao executar ação',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}