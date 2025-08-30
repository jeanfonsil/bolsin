// src/lib/parsers/csv-parser.ts - SINTAXE CORRIGIDA

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
      const parsed = Papa.parse(fileContent as any, {
        header: true,
        dynamicTyping: false, // Manter como string para processamento manual
        skipEmptyLines: 'greedy',
        delimiter: this.detectDelimiter(fileContent)
      })

      if (parsed.errors.length > 0) {
        this.warnings.push('PapaParse warnings: ' + parsed.errors.map(e => e.message).join(', '))
      }

      const rawData = parsed.data as any[]
      const headers = Object.keys(rawData[0] || {})
      
      console.log('📋 Headers detectados: ' + headers.join(', '))
      console.log('📊 ' + rawData.length + ' linhas para processar')

      // Detectar banco e mapeamento de colunas
      const bankInfo = this.detectBank(headers)
      console.log('🏦 Banco detectado: ' + bankInfo.bank + ' (confiança: ' + bankInfo.confidence + ')')

      // Mapear colunas
      const columnMapping = this.mapColumns(headers, bankInfo.mapping)
      console.log('🗺️ Mapeamento:', columnMapping)

      // Processar transações
      const transactions = this.processTransactions(rawData, columnMapping)
      
      console.log('✅ ' + transactions.length + ' transações processadas')

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
      throw new Error('Falha no parsing CSV: ' + (error instanceof Error ? error.message : 'Erro desconhecido'))
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

    console.log('🔍 Delimitador detectado: \'' + bestDelimiter + '\' (' + maxColumns + ' colunas)')
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
        this.warnings.push('Campo obrigatório \'' + field + '\' não encontrado')
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
        this.errors.push('Linha ' + (i + 1) + ': ' + (error instanceof Error ? error.message : 'Erro desconhecido'))
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
      throw new Error('Data inválida: ' + dateField)
    }

    // Processar valor
    const amountResult = this.parseAmount(amountField)
    if (amountResult.amount === null) {
      throw new Error('Valor inválido: ' + amountField)
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

  private parseDate(dateString: string): Date | null {
  if (!dateString || typeof dateString !== 'string') {
    return null
  }

  // Limpar string
  const cleaned = dateString.trim()
  if (!cleaned) return null

  // Tentar diferentes formatos de data brasileiros
  const patterns = [
    // DD/MM/YYYY ou DD/MM/YY
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/,
    // DD-MM-YYYY ou DD-MM-YY  
    /^(\d{1,2})-(\d{1,2})-(\d{2,4})$/,
    // YYYY-MM-DD (ISO)
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    // DD.MM.YYYY
    /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/
  ]

  for (let i = 0; i < patterns.length; i++) {
    const match = cleaned.match(patterns[i])
    if (match) {
      let day: number, month: number, year: number

      if (i === 2) { // YYYY-MM-DD
        year = parseInt(match[1])
        month = parseInt(match[2])
        day = parseInt(match[3])
      } else { // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
        day = parseInt(match[1])
        month = parseInt(match[2])
        year = parseInt(match[3])
      }

      // Ajustar anos de 2 dígitos
      if (year < 100) {
        year += year > 50 ? 1900 : 2000
      }

      // Validar limites básicos
      if (month < 1 || month > 12) continue
      if (day < 1 || day > 31) continue
      if (year < 1900 || year > 2100) continue

      // Criar data (month - 1 porque Date usa 0-11)
      const date = new Date(year, month - 1, day)
      
      // Verificar se a data é válida (não teve overflow)
      if (date.getFullYear() === year && 
          date.getMonth() === month - 1 && 
          date.getDate() === day) {
        return date
      }
    }
  }

  // Se não encontrou padrão, tentar Date() nativo como fallback
  try {
    const nativeDate = new Date(cleaned)
    if (!isNaN(nativeDate.getTime())) {
      // Só aceitar se for uma data razoável
      const year = nativeDate.getFullYear()
      if (year >= 1900 && year <= 2100) {
        return nativeDate
      }
    }
  } catch {}

  return null
}

// ATUALIZAR também o método parseAmount para ser mais robusto
private parseAmount(amountString: string): { amount: number | null, originalSign: string } {
  if (!amountString) {
    return { amount: null, originalSign: '' }
  }

  const cleaned = String(amountString).trim()
  if (!cleaned) return { amount: null, originalSign: '' }

  // Detectar sinal original
  const originalSign = cleaned.includes('-') ? '-' : '+'

  // Remover tudo exceto números, vírgulas e pontos
  let numericStr = cleaned.replace(/[^\d,.+-]/g, '')
  
  // Se vazio após limpeza, retornar null
  if (!numericStr) return { amount: null, originalSign }

  // Tratar diferentes formatos brasileiros
  // 1.234,56 -> 1234.56
  // 1,234.56 -> 1234.56  
  // 1234,56 -> 1234.56
  // 1234.56 -> 1234.56
  
  const commas = (numericStr.match(/,/g) || []).length
  const dots = (numericStr.match(/\./g) || []).length
  
  if (commas === 1 && dots === 0) {
    // Formato brasileiro: 1234,56
    numericStr = numericStr.replace(',', '.')
  } else if (commas === 0 && dots === 1) {
    // Já no formato correto: 1234.56
    // Não fazer nada
  } else if (commas > 0 && dots > 0) {
    // Formato com separadores de milhares
    const lastComma = numericStr.lastIndexOf(',')
    const lastDot = numericStr.lastIndexOf('.')
    
    if (lastComma > lastDot) {
      // 1.234,56 - vírgula é decimal
      numericStr = numericStr.replace(/\./g, '').replace(',', '.')
    } else {
      // 1,234.56 - ponto é decimal
      numericStr = numericStr.replace(/,/g, '')
    }
  }

  // Remover sinais múltiplos e manter apenas um
  const isNegative = numericStr.includes('-')
  numericStr = numericStr.replace(/[+-]/g, '')
  
  const parsed = parseFloat(numericStr)
  
  if (isNaN(parsed)) {
    return { amount: null, originalSign }
  }

  return { 
    amount: isNegative ? -Math.abs(parsed) : Math.abs(parsed), 
    originalSign 
  }
}

  private parseType(typeField: string | null, amount: number, originalSign: string): 'debit' | 'credit' {
    // Se há campo de tipo específico, usar ele
    if (typeField && typeof typeField === 'string') {
      const normalized = typeField.toLowerCase().trim()
      if (normalized.includes('credit') || normalized.includes('entrada') || normalized.includes('deposito')) {
        return 'credit'
      }
      if (normalized.includes('debit') || normalized.includes('saida') || normalized.includes('saque')) {
        return 'debit'
      }
    }

    // Usar sinal do valor como fallback
    return amount >= 0 ? 'credit' : 'debit'
  }

  private cleanDescription(description: string): string {
    if (!description || typeof description !== 'string') {
      return 'Transação sem descrição'
    }

    // Preservar acentos e caracteres unicode, removendo apenas controles
    return description
      .normalize('NFC')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[\u0000-\u001F\u007F]/g, '') // remover caracteres de controle
      .substring(0, 200) // Limitar tamanho
  }

  private calculateConfidence(date: Date, description: string, amount: number): number {
    let confidence = 0.5 // Base

    // Aumentar confiança baseado na qualidade dos dados
    if (date && !isNaN(date.getTime())) {
      confidence += 0.2
    }

    if (description && description.length > 5) {
      confidence += 0.2
    }

    if (!isNaN(amount) && amount !== 0) {
      confidence += 0.1
    }

    return Math.min(1.0, confidence)
  }
}
