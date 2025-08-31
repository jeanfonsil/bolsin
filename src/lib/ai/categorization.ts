// Clean UTF-8 version (ASCII-only strings to avoid encoding issues)
import OpenAI from 'openai'

let openaiClient: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY missing when initializing OpenAI client')
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

export const CATEGORIES = [
  'Alimentacao',
  'Transporte',
  'Moradia',
  'Saude',
  'Educacao',
  'Lazer',
  'Compras',
  'Servicos',
  'Investimentos',
  'Transferencias',
  'Pagamentos',
  'Outros'
] as const

export type Category = typeof CATEGORIES[number]

export interface CategorizedTransaction {
  description: string
  category: Category
  confidence: number
  reasoning?: string
}

const CATEGORIZATION_PROMPT = `Voce e um especialista em categorizacao de transacoes financeiras brasileiras.

CATEGORIAS DISPONIVEIS:
- Alimentacao: restaurantes, supermercados, delivery, padaria
- Transporte: Uber, combustivel, estacionamento, transporte publico
- Moradia: aluguel, condominio, energia, agua, internet, gas
- Saude: farmacia, medicos, planos de saude, exames
- Educacao: cursos, livros, mensalidades, material escolar
- Lazer: cinema, streaming, jogos, viagens, academia
- Compras: roupas, eletronicos, cosmeticos, presentes
- Servicos: cabeleireiro, limpeza, reparos, consultorias
- Investimentos: aplicacoes, acoes, fundos, cripto
- Transferencias: PIX, TED, DOC entre contas proprias
- Pagamentos: cartao de credito, financiamentos, emprestimos
- Outros: quando nao se encaixa em nenhuma categoria

INSTRUCOES:
1. Analise cada descricao de transacao
2. Categorize com base no contexto brasileiro
3. Atribua confianca de 0.0 a 1.0
4. Seja consistente nas categorizacoes
5. Use "Outros" apenas quando necessario

Formato de resposta JSON:
{
  "transactions": [
    {
      "description": "descricao original",
      "category": "categoria escolhida",
      "confidence": 0.95,
      "reasoning": "breve explicacao"
    }
  ]
}`

export async function categorizeTransactions(
  descriptions: string[]
): Promise<CategorizedTransaction[]> {
  if (!descriptions || descriptions.length === 0) return []

  if (!process.env.OPENAI_API_KEY) {
    console.warn('OpenAI API key not configured, using local fallback categorization')
    return fallbackCategorization(descriptions)
  }

  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: CATEGORIZATION_PROMPT + '\n\nResponda SOMENTE com JSON valido conforme o formato especificado.' },
        { role: 'user', content: `Categorize estas transacoes:\n${descriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')}` }
      ]
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('Resposta vazia da OpenAI')

    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch {
      const first = content.indexOf('{')
      const last = content.lastIndexOf('}')
      if (first !== -1 && last !== -1 && last > first) parsed = JSON.parse(content.slice(first, last + 1))
      else throw new Error('Resposta nao-JSON da OpenAI')
    }

    const transactions = parsed.transactions || []
    return transactions.map((tx: any, index: number) => ({
      description: descriptions[index] || tx.description,
      category: validateCategory(tx.category),
      confidence: Math.max(0, Math.min(1, Number(tx.confidence ?? 0.5))),
      reasoning: tx.reasoning
    }))
  } catch (error) {
    console.error('Erro na categorizacao OpenAI:', error)
    return fallbackCategorization(descriptions)
  }
}

function validateCategory(category: string): Category {
  const normalized = (category || '').trim().toLowerCase()
  const found = CATEGORIES.find(cat => cat.toLowerCase() === normalized)
  return found || 'Outros'
}

function fallbackCategorization(descriptions: string[]): CategorizedTransaction[] {
  const patterns: Record<string, RegExp> = {
    Alimentacao: /uber eats|ifood|rappi|supermercado|padaria|restaurante|lanchonete|delivery|mc\s*donald|burger|pizza/i,
    Transporte: /\buber\b|\b99\b|taxi|combustivel|posto|gasolina|etanol|estacionamento|metro|onibus/i,
    Moradia: /aluguel|condominio|energia|light|copel|cemig|internet|vivo\b|oi\b|tim\b|agua\b|gas\b/i,
    Lazer: /netflix|spotify|amazon\s*prime|cinema|shopping|academia|smart\s*fit|bio\s*ritmo/i,
    Transferencias: /\bpix\b|\bted\b|\bdoc\b|transferencia|saque/i,
    Pagamentos: /cartao.*credito|financiamento|emprestimo|parcela/i
  }

  return descriptions.map(description => {
    for (const [category, pattern] of Object.entries(patterns)) {
      if (pattern.test(description)) {
        return { description, category: category as Category, confidence: 0.8, reasoning: 'Detectado por padrao' }
      }
    }
    return { description, category: 'Outros', confidence: 0.3, reasoning: 'Sem padrao especifico' }
  })
}

export interface CategorizationAnalysis {
  averageConfidence: number
  lowConfidenceCount: number
  highConfidenceCount: number
  suggestions: string[]
}

export function analyzeCategorizationConfidence(
  transactions: CategorizedTransaction[]
): CategorizationAnalysis {
  if (transactions.length === 0) {
    return { averageConfidence: 0, lowConfidenceCount: 0, highConfidenceCount: 0, suggestions: ['Nenhuma transacao para analisar'] }
  }
  const confidences = transactions.map(t => t.confidence)
  const average = confidences.reduce((a, b) => a + b, 0) / confidences.length
  const lowConfidence = transactions.filter(t => t.confidence < 0.6)
  const highConfidence = transactions.filter(t => t.confidence >= 0.8)
  const suggestions: string[] = []
  if (lowConfidence.length > transactions.length * 0.3) suggestions.push('Muitas transacoes com baixa confianca')
  if (average < 0.7) suggestions.push('Confianca geral baixa; pode exigir mais contexto')
  if (suggestions.length === 0) suggestions.push('Categorizacao com boa qualidade')
  return { averageConfidence: average, lowConfidenceCount: lowConfidence.length, highConfidenceCount: highConfidence.length, suggestions }
}

