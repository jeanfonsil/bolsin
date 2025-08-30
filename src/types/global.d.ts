// Tipos globais para o projeto

declare global {
  // File store global
  var debugFileStore: Map<string, {
    buffer: Buffer
    metadata: {
      originalName: string
      fileType: string
      mimeType: string
      size: number
      uploadedAt: string
    }
  }> | undefined

  // Outras variáveis globais do Node.js
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test'
      OPENAI_API_KEY?: string
      DATABASE_URL?: string
      NEXTAUTH_SECRET?: string
      NEXTAUTH_URL?: string
    }
  }
}

// Tipos para as APIs
export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface FileMetadata {
  originalName: string
  fileType: 'csv' | 'pdf' | 'xls' | 'xlsx'
  mimeType: string
  size: number
  uploadedAt: string
}

export interface ProcessedTransaction {
  id: string
  date: string
  description: string
  amount: string | number
  category: string
  confidence: number
}

export interface ProcessingResult {
  transactions: number
  categories: string[]
  analysis: {
    averageConfidence: number
    categoryDistribution: Record<string, number>
    processingTime: number
  }
  rawTransactions: ProcessedTransaction[]
  metadata: {
    fileId: string
    originalName: string
    processedAt: string
    linesProcessed: number
  }
}

// Necessário para que este arquivo seja tratado como módulo
export {}