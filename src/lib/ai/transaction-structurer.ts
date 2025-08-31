import OpenAI from 'openai'

type Direction = 'in' | 'out'
type Channel = 'card' | 'pix' | 'transfer' | 'boleto' | 'fee' | 'interest' | 'investment' | 'cash' | 'other'

export interface StructuredInfo {
  channel: Channel
  direction: Direction
  method?: string
  counterparty?: string
  notes?: string
}

let openaiClient: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const key = process.env.OPENAI_API_KEY
    if (!key) throw new Error('OPENAI_API_KEY missing')
    openaiClient = new OpenAI({ apiKey: key })
  }
  return openaiClient
}

export async function structureTransactions(
  rows: Array<{ description: string; amount: number; type: 'debit' | 'credit' }>
): Promise<StructuredInfo[]> {
  if (!process.env.OPENAI_API_KEY) {
    return rows.map(r => heuristic(r.description, r.amount, r.type))
  }

  try {
    const sys = `Classifique transacoes financeiras brasileiras em um dos canais: 
card (compras no cartao), pix, transfer (TED/DOC/entre contas), boleto, fee (tarifas/IOF), interest (juros/rendimentos), investment (aplicacoes), cash (saques/depósitos), other.
Tambem indique direction (in/out), counterparty (quando houver) e notas curtas.
Responda apenas JSON no formato: { "items": [{"channel":"...","direction":"...","method":"...","counterparty":"...","notes":"..."}] }.`

    const user = rows
      .map((r, i) => `${i + 1}. ${r.description} | valor: ${r.amount.toFixed(2)} | tipo: ${r.type}`)
      .join('\n')

    const resp = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: `Classifique:\n${user}` }
      ]
    })

    const content = resp.choices[0]?.message?.content || ''
    const parsed = JSON.parse(content)
    const items = Array.isArray(parsed?.items) ? parsed.items : []
    return rows.map((r, idx) => sanitize(items[idx]))
  } catch (e) {
    return rows.map(r => heuristic(r.description, r.amount, r.type))
  }
}

function sanitize(it: any): StructuredInfo {
  const channelList: Channel[] = ['card','pix','transfer','boleto','fee','interest','investment','cash','other']
  const ch: Channel = channelList.includes((it?.channel || '').toLowerCase())
    ? (it.channel as Channel)
    : 'other'
  const dir: Direction = (it?.direction === 'in' || it?.direction === 'out') ? it.direction : 'out'
  return {
    channel: ch,
    direction: dir,
    method: it?.method || undefined,
    counterparty: it?.counterparty || undefined,
    notes: it?.notes || undefined,
  }
}

function heuristic(description: string, amount: number, type: 'debit'|'credit'): StructuredInfo {
  const d = description.toLowerCase()
  // PIX
  if (/\bpix\b/.test(d)) {
    const dir: Direction = type === 'credit' || /recebid|entrada/.test(d) ? 'in' : 'out'
    return { channel: 'pix', direction: dir, method: 'PIX', counterparty: extractCounterparty(d) }
  }
  // Transfer
  if (/(\bted\b|\bdoc\b|transfer[êe]ncia|entre contas)/.test(d)) {
    const dir: Direction = type === 'credit' || /recebid|entrada/.test(d) ? 'in' : 'out'
    return { channel: 'transfer', direction: dir, method: /ted/i.test(d)?'TED':/doc/i.test(d)?'DOC':'Transferencia', counterparty: extractCounterparty(d) }
  }
  // Boleto
  if (/boleto|fatura|conta de luz|conta de agua|conta de gas/.test(d)) {
    return { channel: 'boleto', direction: 'out', method: 'Boleto' }
  }
  // Fees / IOF
  if (/tarifa|iof|juros|anuidade|multa/.test(d)) {
    return { channel: /juros/.test(d)?'interest':'fee', direction: 'out' }
  }
  // Card (default for most compras)
  if (/\b\*|visa|master|elo|amex|parcel|compra|mercadolivre|ifood|uber|recarga|pag\s*seguro|pichau|magalu|loja|ltda|lanchonete|restaurante/.test(d)) {
    return { channel: 'card', direction: type === 'credit' ? 'in' : 'out', counterparty: extractCounterparty(d) }
  }
  // Incoming
  if (type === 'credit' || /(recebid|deposito|cashback|estorno|reembolso)/.test(d)) {
    return { channel: 'other', direction: 'in', counterparty: extractCounterparty(d) }
  }
  return { channel: 'other', direction: type === 'credit' ? 'in' : 'out' }
}

function extractCounterparty(d: string): string | undefined {
  const m = d.match(/\b([a-z0-9][a-z0-9\s\-\*\.]{3,30})$/i)
  return m ? m[1].toUpperCase().trim() : undefined
}

