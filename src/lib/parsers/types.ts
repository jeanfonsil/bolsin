export interface RawTransaction {
  date: string
  description: string
  amount: string
  type?: string
  balance?: string
  category?: string
}

export interface NormalizedTransaction {
  date: Date
  description: string
  amount: number
  type: 'debit' | 'credit'
  originalAmount: string
  confidence: number
  metadata?: {
    balance?: number
    originalDate?: string
    processingNotes?: string[]
  }
}

export interface ParseResult {
  transactions: NormalizedTransaction[]
  metadata: {
    totalRows: number
    successfulRows: number
    errorRows: number
    detectedBank?: string
    detectedFormat?: string
    headers: string[]
    errors: string[]
    warnings: string[]
  }
}

export interface ColumnMapping {
  date: string[]
  description: string[]
  amount: string[]
  type?: string[]
  balance?: string[]
}

// Mapeamentos de colunas para bancos brasileiros
export const BANK_COLUMN_MAPPINGS: Record<string, ColumnMapping> = {
  nubank: {
    date: ['data', 'date'],
    description: ['descrição', 'description', 'estabelecimento'],
    amount: ['valor', 'amount', 'quantia']
  },
  itau: {
    date: ['data', 'data movimento', 'data transacao'],
    description: ['descricao', 'descrição', 'historico', 'documento'],
    amount: ['valor', 'valor reais', 'debito', 'credito'],
    type: ['tipo', 'debito/credito']
  },
  bradesco: {
    date: ['data', 'data movimento'],
    description: ['historico', 'descricao operacao'],
    amount: ['valor', 'debito', 'credito'],
    balance: ['saldo']
  },
  bb: {
    date: ['data', 'data movimento'],
    description: ['historico', 'descricao'],
    amount: ['valor', 'debito', 'credito'],
    type: ['tipo operacao']
  },
  santander: {
    date: ['data'],
    description: ['descricao', 'historico'],
    amount: ['valor', 'debito', 'credito']
  },
  generic: {
    date: ['data', 'date', 'dt', 'data movimento', 'data transacao'],
    description: ['descrição', 'description', 'descricao', 'historico', 'desc', 'estabelecimento'],
    amount: ['valor', 'amount', 'quantia', 'debito', 'credito', 'val'],
    type: ['tipo', 'type', 'debito/credito', 'operacao'],
    balance: ['saldo', 'balance', 'saldo atual']
  }
}