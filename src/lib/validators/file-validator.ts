export interface FileValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  metadata: {
    detectedEncoding?: string
    estimatedBank?: string
    rowCount?: number
    hasHeaders?: boolean
  }
}

export class FileValidator {
  static validateCSV(content: string, filename: string): FileValidationResult {
    const result: FileValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      metadata: {}
    }

    // 1. Validação básica de conteúdo
    if (!content || content.trim().length === 0) {
      result.errors.push('Arquivo CSV está vazio')
      result.isValid = false
      return result
    }

    // 2. Verificar encoding
    const encodingCheck = this.detectEncoding(content)
    result.metadata.detectedEncoding = encodingCheck

    // 3. Analisar estrutura
    const lines = content.split('\n').filter(line => line.trim())
    result.metadata.rowCount = lines.length

    if (lines.length < 2) {
      result.errors.push('CSV deve ter pelo menos 2 linhas (cabeçalho + dados)')
      result.isValid = false
      return result
    }

    // 4. Detectar delimitador
    const delimiter = this.detectDelimiter(lines[0])
    if (!delimiter) {
      result.errors.push('Não foi possível detectar o delimitador (vírgula, ponto-vírgula, etc.)')
      result.isValid = false
      return result
    }

    // 5. Verificar cabeçalhos
    const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase())
    result.metadata.hasHeaders = this.hasValidHeaders(headers)

    if (!result.metadata.hasHeaders) {
      result.warnings.push('Cabeçalhos não detectados automaticamente')
    }

    // 6. Detectar banco
    result.metadata.estimatedBank = this.detectBank(headers, filename)

    // 7. Validar amostra de dados
    const sampleValidation = this.validateSampleData(lines.slice(1, 4), delimiter)
    result.warnings.push(...sampleValidation.warnings)
    result.errors.push(...sampleValidation.errors)

    if (result.errors.length > 0) {
      result.isValid = false
    }

    return result
  }

  private static detectEncoding(content: string): string {
    // Heurísticas simples para detectar encoding
    const hasUtf8Artifacts = /Ã|Â|�/.test(content)
    const hasBrazilianChars = /[áàãâéêíóôõúç]/i.test(content)
    
    if (hasUtf8Artifacts && hasBrazilianChars) {
      return 'latin1'
    } else if (hasBrazilianChars) {
      return 'utf8'
    }
    return 'utf8'
  }

  private static detectDelimiter(firstLine: string): string | null {
    const delimiters = [',', ';', '\t', '|']
    let bestDelimiter = null
    let maxColumns = 0

    for (const delimiter of delimiters) {
      const columns = firstLine.split(delimiter).length
      if (columns > maxColumns && columns >= 3) {
        maxColumns = columns
        bestDelimiter = delimiter
      }
    }

    return bestDelimiter
  }

  private static hasValidHeaders(headers: string[]): boolean {
    const expectedFields = ['data', 'date', 'descrição', 'description', 'valor', 'amount']
    const foundFields = headers.filter(header => 
      expectedFields.some(field => header.includes(field))
    )
    return foundFields.length >= 2
  }

  private static detectBank(headers: string[], filename: string): string {
    const filename_lower = filename.toLowerCase()
    const headers_str = headers.join(' ').toLowerCase()

    // Detectar por nome do arquivo
    if (filename_lower.includes('nubank')) return 'nubank'
    if (filename_lower.includes('itau')) return 'itau'
    if (filename_lower.includes('bradesco')) return 'bradesco'
    if (filename_lower.includes('santander')) return 'santander'
    if (filename_lower.includes('bb') || filename_lower.includes('brasil')) return 'bb'

    // Detectar por cabeçalhos específicos
    if (headers_str.includes('estabelecimento')) return 'nubank'
    if (headers_str.includes('agencia') && headers_str.includes('conta')) return 'bb'
    if (headers_str.includes('historico')) return 'itau'

    return 'generic'
  }

  private static validateSampleData(sampleLines: string[], delimiter: string): {
    warnings: string[]
    errors: string[]
  } {
    const warnings: string[] = []
    const errors: string[] = []

    for (let i = 0; i < sampleLines.length; i++) {
      const line = sampleLines[i]
      const columns = line.split(delimiter)

      // Verificar se tem dados suficientes
      if (columns.length < 3) {
        errors.push(`Linha ${i + 2}: muito poucas colunas (${columns.length})`)
        continue
      }

      // Verificar se tem pelo menos um campo que parece ser valor
      const hasAmountField = columns.some(col => 
        /[\d.,]+/.test(col.trim()) && col.trim().length > 0
      )

      if (!hasAmountField) {
        warnings.push(`Linha ${i + 2}: nenhum campo numérico detectado`)
      }

      // Verificar se tem campo que parece ser data
      const hasDateField = columns.some(col => 
        /\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}/.test(col.trim())
      )

      if (!hasDateField) {
        warnings.push(`Linha ${i + 2}: nenhum campo de data detectado`)
      }
    }

    return { warnings, errors }
  }

  // Validação específica para PDF
  static validatePDF(buffer: Buffer, filename: string): FileValidationResult {
    const result: FileValidationResult = {
      isValid: false,
      errors: ['Processamento de PDF não implementado ainda'],
      warnings: ['Use CSV por enquanto para melhor compatibilidade'],
      metadata: {}
    }

    // TODO: Implementar validação de PDF quando o parser estiver pronto
    return result
  }
}