import OpenAI from 'openai'

let openaiClient: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY ausente ao inicializar OpenAI')
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

export const CATEGORIES = [
  'Alimentação',
  'Transporte', 
  'Moradia',
  'Saúde',
  'Educação',
  'Lazer',
  'Compras',
  'Serviços',
  'Investimentos',
  'Transferências',
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

const CATEGORIZATION_PROMPT = `Você é um especialista em categorização de transações financeiras brasileiras.

CATEGORIAS DISPONÍVEIS:
- Alimentação: restaurantes, supermercados, delivery, padaria
- Transporte: Uber, combustível, estacionamento, transporte público
- Moradia: aluguel, condomínio, energia, água, internet, gás
- Saúde: farmácia, médicos, planos de saúde, exames
- Educação: cursos, livros, mensalidades, material escolar
- Lazer: cinema, streaming, jogos, viagens, academia
- Compras: roupas, eletrônicos, cosméticos, presentes
- Serviços: cabeleireiro, limpeza, reparos, consultorias
- Investimentos: aplicações, ações, fundos, cripto
- Transferências: PIX, TED, DOC entre contas próprias
- Pagamentos: cartão de crédito, financiamentos, empréstimos
- Outros: quando não se encaixa em nenhuma categoria

INSTRUÇÕES:
1. Analise cada descrição de transação
2. Categorize com base no contexto brasileiro
3. Atribua confiança de 0.0 a 1.0
4. Seja consistente nas categorizações
5. Use "Outros" apenas quando necessário

Formato de resposta JSON:
{
  "transactions": [
    {
      "description": "descrição original",
      "category": "categoria escolhida",
      "confidence": 0.95,
      "reasoning": "breve explicação"
    }
  ]
}`

export async function categorizeTransactions(
  descriptions: string[]
): Promise<CategorizedTransaction[]> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OpenAI API key não configurada, usando categorização fallback')
    return fallbackCategorization(descriptions)
  }

  try {
    console.log(`🧠 Categorizando ${descriptions.length} transações...`)
    
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 2000,
      messages: [
        {
          role: 'system',
          content: CATEGORIZATION_PROMPT
        },
        {
          role: 'user',
          content: `Categorize essas transações:\n${descriptions.map((desc, i) => `${i+1}. ${desc}`).join('\n')}`
        }
      ]
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Resposta vazia da OpenAI')
    }

    const parsed = JSON.parse(content)
    const transactions = parsed.transactions || []

    console.log(`✅ ${transactions.length} transações categorizadas`)
    
    return transactions.map((tx: any, index: number) => ({
      description: descriptions[index] || tx.description,
      category: validateCategory(tx.category),
      confidence: Math.max(0, Math.min(1, tx.confidence || 0.5)),
      reasoning: tx.reasoning
    }))

  } catch (error) {
    console.error('Erro na categorização OpenAI:', error)
    console.log('🔄 Usando categorização fallback')
    return fallbackCategorization(descriptions)
  }
}

function validateCategory(category: string): Category {
  const normalized = category?.trim()
  const found = CATEGORIES.find(cat => 
    cat.toLowerCase() === normalized?.toLowerCase()
  )
  return found || 'Outros'
}

function fallbackCategorization(descriptions: string[]): CategorizedTransaction[] {
  const patterns = {
    'Alimentação': /uber eats|ifood|rappi|supermercado|padaria|restaurante|lanchonete|delivery|mc\s*donald|burger|pizza/i,
    'Transporte': /uber|99|taxi|combustivel|posto|gasolina|etanol|estacionamento|metro|onibus/i,
    'Moradia': /aluguel|condominio|energia|light|copel|cemig|internet|vivo|oi|tim|agua|gas/i,
    'Saúde': /farmacia|drogaria|medico|hospital|clinica|plano.*saude|unimed|amil|bradesco.*saude/i,
    'Lazer': /netflix|spotify|amazon prime|cinema|shopping|academia|smart fit|bio ritmo/i,
    'Transferências': /pix|ted|doc|transferencia|saque/i,
    'Pagamentos': /cartao.*credito|financiamento|emprestimo|parcela/i
  }

  return descriptions.map(description => {
    for (const [category, pattern] of Object.entries(patterns)) {
      if (pattern.test(description)) {
        return {
          description,
          category: category as Category,
          confidence: 0.8,
          reasoning: `Detectado por padrão: ${pattern.source.slice(0, 30)}...`
        }
      }
    }
    
    return {
      description,
      category: 'Outros' as Category,
      confidence: 0.3,
      reasoning: 'Não encontrou padrão específico'
    }
  })
}

// Interface para o resultado da análise
export interface CategorizationAnalysis {
  averageConfidence: number
  lowConfidenceCount: number
  highConfidenceCount: number
  suggestions: string[]
}

// Função de análise corrigida
export function analyzeCategorizationConfidence(
  transactions: CategorizedTransaction[]
): CategorizationAnalysis {
  if (transactions.length === 0) {
    return {
      averageConfidence: 0,
      lowConfidenceCount: 0,
      highConfidenceCount: 0,
      suggestions: ['Nenhuma transação para analisar']
    }
  }

  const confidences = transactions.map(t => t.confidence)
  const average = confidences.reduce((a, b) => a + b, 0) / confidences.length
  
  const lowConfidence = transactions.filter(t => t.confidence < 0.6)
  const highConfidence = transactions.filter(t => t.confidence >= 0.8)
  
  const suggestions: string[] = []
  if (lowConfidence.length > transactions.length * 0.3) {
    suggestions.push('Muitas transações com baixa confiança. Considere revisar manualmente.')
  }
  if (average < 0.7) {
    suggestions.push('Confiança geral baixa. Dados podem precisar de mais contexto.')
  }
  if (suggestions.length === 0) {
    suggestions.push('Categorização com boa qualidade!')
  }
  
  return {
    averageConfidence: average,
    lowConfidenceCount: lowConfidence.length,
    highConfidenceCount: highConfidence.length,
    suggestions
  }
}
