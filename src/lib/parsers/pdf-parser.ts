import { NormalizedTransaction, ParseResult } from './types'

export class PDFParser {
  private errors: string[] = []
  private warnings: string[] = []

  async parse(buffer: Buffer, password?: string): Promise<ParseResult> {
    this.errors = []
    this.warnings = []
    try {
      const { default: pdfParse } = await import('pdf-parse')
      const opts: any = {}
      if (password) opts.password = password
      const { text } = await pdfParse(buffer, opts)
      return this.buildResultFromText(text)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/password/i.test(msg)) throw new Error('PDF protegido por senha')
      throw new Error('Falha ao ler PDF: ' + msg)
    }
  }

  private buildResultFromText(text: string): ParseResult {
    const lines = text
      .replace(/\r/g, '\n')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)

    const bank = this.detectBankByHeuristics(lines)
    const transactions = bank === 'nubank'
      ? this.extractNubankTransactions(lines)
      : this.extractTransactions(lines)

    return {
      transactions,
      metadata: {
        totalRows: lines.length,
        successfulRows: transactions.length,
        errorRows: Math.max(0, lines.length - transactions.length),
        detectedBank: bank,
        detectedFormat: 'pdf',
        headers: [],
        errors: this.errors,
        warnings: this.warnings,
      }
    }
  }

  // Nubank credit card statement heuristic
  private extractNubankTransactions(lines: string[]): NormalizedTransaction[] {
    const txs: NormalizedTransaction[] = []
    const monthMap: Record<string, number> = { jan:1, fev:2, mar:3, abr:4, mai:5, jun:6, jul:7, ago:8, set:9, out:10, nov:11, dez:12 }
    // Do not filter out 'pagamento' to keep payment credit
    const isHeader = (l: string) => /resumo|fatura|vencimento|limite|total|valores|detalhes|nuconta|cart[aã]o/i.test(l)
    const dateDM = /^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/i
    const dateDMMon = /^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b\s*(\d{2,4})?/i
    const amountTailBR = /(R\$\s*)?([+-]?\d{1,3}(?:\.\d{3})*,\d{2}|[+-]?\d+,\d{2})\s*$/
    const amountAnyBR = /(R\$\s*)([+-]?\d{1,3}(?:\.\d{3})*,\d{2}|[+-]?\d+,\d{2})/i

    let lastDate: Date | null = null

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line || isHeader(line)) continue
      let date: Date | null = null
      let desc = ''
      let amountStr = ''

      const m = line.match(dateDM)
      if (m) {
        const d = parseInt(m[1], 10)
        const mo = parseInt(m[2], 10)
        const y = m[3] ? parseInt(m[3], 10) : new Date().getFullYear()
        date = this.parseDate(`${d}/${mo}/${y}`)
        if (date) lastDate = date
      } else {
        const m2 = line.match(dateDMMon)
        if (m2) {
          const d = parseInt(m2[1], 10)
          const mo = monthMap[m2[2].toLowerCase()]
          const y = m2[3] ? parseInt(m2[3], 10) : new Date().getFullYear()
          if (mo) {
            date = new Date(y < 100 ? (y > 50 ? 1900 + y : 2000 + y) : y, mo - 1, d)
            lastDate = date
          }
        }
      }

      if (!date) {
        if (lastDate) date = lastDate
        else continue
      }

      // find BRL amount
      const a = line.match(amountTailBR) || line.match(amountAnyBR)
      if (a) {
        amountStr = a[2]
        desc = line
          .replace(a[0], '')
          .replace(/^\d{1,2}(?:[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)?\s*/, '')
          .trim()
        // Avoid merging with next transaction start inside description
        const nextIdx = desc.search(/(?:^|\s)(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|\d{1,2}\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b)/i)
        if (nextIdx > 0) desc = desc.slice(0, nextIdx).trim()
      } else if (i + 1 < lines.length) {
        // scan next up to 4 lines (conversion blocks). Prefer the LAST BRL found (e.g., final R$ total instead of rate).
        let combined = line
        let lastMatch: RegExpMatchArray | null = null
        let lastK = 0
        for (let k = 1; k <= 4 && (i + k) < lines.length; k++) {
          const ln = lines[i + k]
          combined += ' ' + ln
          const ak = ln.match(amountTailBR) || ln.match(amountAnyBR)
          if (ak) {
            lastMatch = ak
            lastK = k
            // continue scanning to prefer the last occurrence (final BRL amount)
          }
        }
        if (lastMatch) {
          amountStr = lastMatch[2]
          desc = combined.replace(lastMatch[0], '').trim()
          // Avoid merging with next transaction start inside combined description
          const nextIdx = desc.search(/(?:^|\s)(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|\d{1,2}\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b)/i)
          if (nextIdx > 0) desc = desc.slice(0, nextIdx).trim()
          // Capture FX details (USD amount and rate) into processing notes via metadata later
          const usdMatch = combined.match(/(?:US\$|USD)\s*([0-9.,]+)/i)
          const rateMatch = combined.match(/(?:cota[cç]ao|convers[aã]o)[^R]*R\$\s*([0-9.,]+)/i)
          if (usdMatch || rateMatch) {
            // Append hints into description to avoid losing information
            const hints: string[] = []
            if (usdMatch) hints.push(`USD ${usdMatch[1]}`)
            if (rateMatch) hints.push(`cambio R$ ${rateMatch[1]} por USD 1`)
            if (hints.length) desc = `${desc} (${hints.join(' • ')})`
          }
          i += lastK
        } else {
          continue
        }
      }

      if (!amountStr || !desc) continue
      const amountParsed = this.parseAmount(amountStr)
      if (amountParsed.amount === null) continue

      const isCredit = /(pagamento(\s+recebido)?|ajuste|estorno|credito)/i.test(desc)
      const type = isCredit ? 'credit' : 'debit'

      txs.push({
        date,
        description: this.cleanDescription(desc),
        amount: Math.abs(amountParsed.amount),
        type,
        originalAmount: amountStr,
        confidence: this.calculateConfidence(date, desc, amountParsed.amount)
      })
    }
    return txs.length > 0 ? txs : this.extractTransactions(lines)
  }

  private extractTransactions(lines: string[]): NormalizedTransaction[] {
    const txs: NormalizedTransaction[] = []
    const dateRegex = /^(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\b/i
    const amountTailRegex = /([+-]?\d{1,3}(?:[\.,]\d{3})*[\.,]\d{2}|[+-]?\d+[\.,]\d{2})$/

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const dateMatch = line.match(dateRegex)
      const amountMatch = line.match(amountTailRegex)
      if (!dateMatch || !amountMatch) continue

      const dateStr = dateMatch[1]
      const amountStr = amountMatch[1]
      const desc = line
        .slice(dateMatch[0].length)
        .slice(0, line.length - amountStr.length)
        .trim()

      const date = this.parseDate(dateStr)
      const amountParsed = this.parseAmount(amountStr)
      if (!date || amountParsed.amount === null) {
        this.warnings.push(`Linha ${i + 1}: nao foi possivel ler data/valor`)
        continue
      }

      const type = amountParsed.amount >= 0 ? 'credit' : 'debit'
      txs.push({
        date,
        description: this.cleanDescription(desc),
        amount: Math.abs(amountParsed.amount),
        type,
        originalAmount: amountStr,
        confidence: this.calculateConfidence(date, desc, amountParsed.amount)
      })
    }

    // secondary heuristic: date at line i, amount at line j
    if (txs.length === 0) {
      for (let i = 0; i < lines.length; i++) {
        const dateMatch = lines[i].match(dateRegex)
        if (!dateMatch) continue
        for (let j = i; j < Math.min(i + 3, lines.length); j++) {
          const amountMatch = lines[j].match(amountTailRegex)
          if (amountMatch) {
            const desc = lines.slice(i, j + 1).join(' ').trim()
            const date = this.parseDate(dateMatch[1])
            const amountParsed = this.parseAmount(amountMatch[1])
            if (date && amountParsed.amount !== null) {
              txs.push({
                date,
                description: this.cleanDescription(desc),
                amount: Math.abs(amountParsed.amount),
                type: amountParsed.amount >= 0 ? 'credit' : 'debit',
                originalAmount: amountMatch[1],
                confidence: this.calculateConfidence(date, desc, amountParsed.amount)
              })
              i = j
              break
            }
          }
        }
      }
    }

    if (txs.length === 0) this.errors.push('Nenhuma transacao detectada no PDF com as heuristicas atuais')
    return txs
  }

  private detectBankByHeuristics(lines: string[]): string {
    const text = lines.join(' ').toLowerCase()
    if (/nubank|nu\s*pagamentos/.test(text)) return 'nubank'
    if (/itau|ita[úu]/.test(text)) return 'itau'
    if (/bradesco/.test(text)) return 'bradesco'
    if (/(banco\s*do\s*brasil|bb)\b/.test(text)) return 'bb'
    if (/santander/.test(text)) return 'santander'
    return 'generic'
  }

  private parseDate(dateString: string): Date | null {
    const cleaned = (dateString || '').trim()
    const patterns = [
      /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/,
      /^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/
    ]
    for (let i = 0; i < patterns.length; i++) {
      const m = cleaned.match(patterns[i])
      if (!m) continue
      let d: number, mth: number, y: number
      if (i === 1) { y = +m[1]; mth = +m[2]; d = +m[3] } else { d = +m[1]; mth = +m[2]; y = +m[3] }
      if (y < 100) y += y > 50 ? 1900 : 2000
      const dt = new Date(y, mth - 1, d)
      if (dt.getFullYear() === y && dt.getMonth() === mth - 1 && dt.getDate() === d) return dt
    }
    const n = new Date(cleaned)
    return isNaN(n.getTime()) ? null : n
  }

  private parseAmount(amountString: string): { amount: number | null } {
    if (!amountString) return { amount: null }
    let str = String(amountString).trim()
    const commas = (str.match(/,/g) || []).length
    const dots = (str.match(/\./g) || []).length
    if (commas === 1 && dots === 0) {
      str = str.replace('.', '').replace(',', '.')
    } else if (commas > 0 && dots > 0) {
      const lastComma = str.lastIndexOf(',')
      const lastDot = str.lastIndexOf('.')
      if (lastComma > lastDot) str = str.replace(/\./g, '').replace(',', '.')
      else str = str.replace(/,/g, '')
    }
    const negative = /-/.test(str)
    str = str.replace(/[^\d.]/g, '')
    const n = parseFloat(str)
    if (isNaN(n)) return { amount: null }
    return { amount: negative ? -Math.abs(n) : Math.abs(n) }
  }

  private cleanDescription(d: string): string {
    return (d || '')
      .toString()
      .normalize('NFC')
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200)
  }

  private calculateConfidence(date: Date, description: string, amount: number): number {
    let c = 0.5
    if (date && !isNaN(date.getTime())) c += 0.2
    if (description && description.length > 5) c += 0.2
    if (!isNaN(amount)) c += 0.1
    return Math.min(1, c)
  }
}
