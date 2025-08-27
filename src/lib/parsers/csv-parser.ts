import Papa from 'papaparse'
import { 
  RawTransaction, 
  NormalizedTransaction, 
  ParseResult, 
  ColumnMapping,
  BANK_COLUMN_MAPPINGS 
} from './types'

export class CSVParser {
  private errors: string[] = []
  private warnings: string[] = []

  async parseCSV(fileContent: string): Promise<ParseResult> {
    this.errors = []
    this.warnings = []

    try {
      console.log('📊 Iniciando parsing CSV...')
      
      // Parse inicial com PapaParse
      const parsed = Papa.parse(fileContent, {
        header: true,
        dynamicTyping: false, // Manter como string para processamento manual
        skipEmptyLines: 'greedy',
        delimiter: this.detectDelimiter(fileContent),
        encoding: 'UTF-8'
      })

      if (parsed.errors.length > 0) {
        this.warnings.push(`PapaParse warnings: ${parsed.errors.map(e => e.message).join(', ')}`)
      }

      const rawData = parsed.data as any[]
      const headers = Object.keys(rawData[0] || {})
      
      console.log(`📋 Headers detectados: ${headers.join(', ')}`)
      console.log(`📊 ${rawData.length} linhas para processar`)

      // Detectar banco e mapeamento de colunas
      const bankInfo = this.detectBank(headers)
      console.log(`🏦 Banco detectado: ${bankInfo.bank} (confiança: ${bankInfo.confidence})`)

      // Mapear colunas
      const columnMapping = this.mapColumns(headers, bankInfo.mapping)
      console.log('🗺️ Mapeamento:', columnMapping)

      // Processar transações
      const transactions = this.processTransactions(rawData, columnMapping)
      
      console.log(`✅ ${transactions.length} transações processadas`)

      return {
        transactions,
        metadata: {
          totalRows: rawData.length,
          successfulRows: transactions.length,
          errorRows: rawData.length - transactions.length,
          detectedBank: bankInfo.bank,
          detectedFormat: 'csv',
          headers,
          errors: this.errors,
          warnings: this.warnings
        }
      }

    } catch (error) {
      console.error('❌ Erro no parsing CSV:', error)
      throw new Error(`Falha no parsing CSV: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    }
  }

  private detectDelimiter(content: string): string {
    const sample = content.split('\n').slice(0, 5).join('\n')
    const delimiters = [',', ';', '\t', '|']
    
    let bestDelimiter = ','
    let maxColumns = 0

    for (const delimiter of delimiters) {
      const testParse = Papa.parse(sample, { delimiter, header: false })
      if (testParse.data.length > 0) {
        const columnCount = Math.max(...testParse.data.map((row: any) => row.length))
        if (columnCount > maxColumns) {
          maxColumns = columnCount
          bestDelimiter = delimiter
        }
      }
    }

    console.log(`🔍 Delimitador detectado: '${bestDelimiter}' (${maxColumns} colunas)`)
    return bestDelimiter
  }

  private detectBank(headers: string[]): { bank: string, confidence: number, mapping: ColumnMapping } {
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim())
    let bestMatch = { bank: 'generic', confidence: 0, mapping: BANK_COLUMN_MAPPINGS.generic }

    for (const [bankName, mapping] of Object.entries(BANK_COLUMN_MAPPINGS)) {
      if (bankName === 'generic') continue

      let matchScore = 0
      let totalFields = 0

      // Verificar campos obrigatórios
      for (const [field, possibleNames] of Object.entries(mapping)) {
        totalFields++
        for (const name of possibleNames) {
          if (normalizedHeaders.some(h => h.includes(name.toLowerCase()))) {
            matchScore++
            break
          }
        }
      }

      const confidence = matchScore / totalFields

      if (confidence > bestMatch.confidence) {
        bestMatch = { bank: bankName, confidence, mapping }
      }
    }

    // Se confiança muito baixa, usar genérico
    if (bestMatch.confidence < 0.6) {
      bestMatch = { bank: 'generic', confidence: 1, mapping: BANK_COLUMN_MAPPINGS.generic }
    }

    return bestMatch
  }

  private mapColumns(headers: string[], mapping: ColumnMapping): Record<string, string | null> {
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim())
    const result: Record<string, string | null> = {}

    for (const [field, possibleNames] of Object.entries(mapping)) {
      result[field] = null
      
      for (const name of possibleNames) {
        const matchIndex = normalizedHeaders.findIndex(h => h.includes(name.toLowerCase()))
        if (matchIndex !== -1) {
          result[field] = headers[matchIndex]
          break
        }
      }

      if (!result[field] && ['date', 'description', 'amount'].includes(field)) {
        this.warnings.push(`Campo obrigatório '${field}' não encontrado`)
      }
    }

    return result
  }

  private processTransactions(
    rawData: any[], 
    columnMapping: Record<string, string | null>
  ): NormalizedTransaction[] {
    const transactions: NormalizedTransaction[] = []

    for (let i = 0; i < rawData.length; i++) {
      try {
        const row = rawData[i]
        const transaction = this.processTransaction(row, columnMapping, i)
        
        if (transaction) {
          transactions.push(transaction)
        }
      } catch (error) {
        this.errors.push(`Linha ${i + 1}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
      }
    }

    return transactions
  }

  private processTransaction(
    row: any, 
    mapping: Record<string, string | null>, 
    rowIndex: number
  ): NormalizedTransaction | null {
    const processingNotes: string[] = []

    // Extrair campos
    const dateField = mapping.date ? row[mapping.date] : null
    const descField = mapping.description ? row[mapping.description] : null
    const amountField = mapping.amount ? row[mapping.amount] : null
    const typeField = mapping.type ? row[mapping.type] : null
    const balanceField = mapping.balance ? row[mapping.balance] : null

    // Validar campos obrigatórios
    if (!dateField && !descField && !amountField) {
      return null // Linha vazia
    }

    if (!dateField) {
      throw new Error('Data não encontrada')
    }

    if (!descField) {
      throw new Error('Descrição não encontrada')
    }

    if (!amountField) {
      throw new Error('Valor não encontrado')
    }

    // Processar data
    const date = this.parseDate(dateField)
    if (!date) {
      throw new Error(`Data inválida: ${dateField}`)
    }

    // Processar valor
    const amountResult = this.parseAmount(amountField)
    if (amountResult.amount === null) {
      throw new Error(`Valor inválido: ${amountField}`)
    }

    // Processar tipo
    const type = this.parseType(typeField, amountResult.amount, amountResult.originalSign)

    // Processar saldo (opcional)
    const balance = balanceField ? this.parseAmount(balanceField).amount : null

    // Limpar descrição
    const description = this.cleanDescription(descField)

    const transaction: NormalizedTransaction = {
      date,
      description,
      amount: Math.abs(amountResult.amount),
      type,
      originalAmount: amountField,
      confidence: this.calculateConfidence(date, description, amountResult.amount),
      metadata: {
        balance: balance || undefined,
        originalDate: dateField,
        processingNotes: processingNotes.length > 0 ? processingNotes : undefined
      }
    }

    return transaction
  }

  private parseDate(dateStr: string): Date | null {
    if (!dateStr || typeof dateStr !== 'string') return null

    const cleaned = dateStr.trim()
    
    // Formatos brasileiros comuns
    const patterns = [
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // DD/MM/YYYY
      /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, // DD/MM/YY
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // YYYY-MM-DD
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // DD-MM-YYYY
    ]

    for (const pattern of patterns) {
      const match = cleaned.match(pattern)
      if (match) {
        let day: number, month: number, year: number

        if (pattern.source.startsWith('^(\\d{4})')) { // YYYY-MM-DD
          year = parseInt(match[1])
          month = parseInt(match[2]) - 1
          day = parseInt(match[3])
        } else { // DD/MM formats
          day = parseInt(match[1])
          month = parseInt(match[2]) - 1
          year = parseInt(match[3])
          
          // Converter YY para YYYY
          if (year < 100) {
            year += year < 50 ? 2000 : 1900
          }
        }

        const date = new Date(year, month, day)
        
        // Validar se a data é válida
        if (date.getFullYear() === year && 
            date.getMonth() === month && 
            date.getDate() === day) {
          return date
        }
      }
    }

    // Tentar parseamento nativo como fallback
    const nativeDate = new Date(cleaned)
    if (!isNaN(nativeDate.getTime())) {
      return nativeDate
    }

    return null
  }

  private parseAmount(amountStr: string): { amount: number | null, originalSign: string } {
    if (!amountStr || typeof amountStr !== 'string') {
      return { amount: null, originalSign: '' }
    }

    let cleaned = amountStr.trim()
    const originalSign = cleaned.startsWith('-') ? '-' : '+'

    // Remover símbolos de moeda e espaços
    cleaned = cleaned
      .replace(/R\$\s*/, '')
      .replace(/\s+/g, '')
      .replace(/[^\d,.-]/g, '')

    // Detectar formato brasileiro (1.234,56) vs americano (1,234.56)
    const hasBrazilianFormat = /\d+\.\d{3},\d{2}$/.test(cleaned) || /\d+,\d{2}$/.test(cleaned)
    
    if (hasBrazilianFormat) {
      // Formato brasileiro: 1.234.567,89
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    }
    // Senão, assumir formato americano ou já correto

    const amount = parseFloat(cleaned)
    
    if (isNaN(amount)) {
      return { amount: null, originalSign }
    }

    return { 
      amount: originalSign === '-' ? -amount : amount, 
      originalSign 
    }
  }

  private parseType(typeField: string | null, amount: number, originalSign: string): 'debit' | 'credit' {
    if (typeField && typeof typeField === 'string') {
      const type = typeField.toLowerCase().trim()
      if (type.includes('débito') || type.includes('debito') || type.includes('d')) {
        return 'debit'
      }
      if (type.includes('crédito') || type.includes('credito') || type.includes('c')) {
        return 'credit'
      }
    }

    // Fallback: usar o sinal do valor
    return amount < 0 || originalSign === '-' ? 'debit' : 'credit'
  }

  private cleanDescription(description: string): string {
    if (!description || typeof description !== 'string') return 'Transação sem descrição'

    return description
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-áâãàéêíóôõúç]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase()
  }

  private calculateConfidence(date: Date, description: string, amount: number): number {
    let confidence = 0.5 // Base confidence

    // Data válida e recente
    const now = new Date()
    const diffYears = now.getFullYear() - date.getFullYear()
    if (diffYears >= 0 && diffYears <= 5) {
      confidence += 0.2
    }

    // Descrição não vazia e com conteúdo
    if (description && description.length > 3) {
      confidence += 0.2
    }

    // Valor não zero
    if (amount !== 0) {
      confidence += 0.1
    }

    return Math.min(1, Math.max(0, confidence))
  }
}