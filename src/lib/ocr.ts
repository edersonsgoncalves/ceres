import { InvoiceData } from "@/types/invoice";
import { buildExtractionPrompt } from "./prompts";

async function callOllama(baseUrl: string, model: string, prompt: string, imageBase64: string): Promise<string> {
  const base64Data = imageBase64.startsWith("data:") ? imageBase64.split(",")[1] : imageBase64;
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt, images: [base64Data] }],
      stream: false,
      options: { temperature: 0.1, num_predict: 4096 },
    }),
  });
  if (!response.ok) {
    const errorData = await response.text();
    console.error("Erro no Ollama:", errorData);
    throw new Error("Erro ao processar imagem no Ollama");
  }
  const data = await response.json();
  return data.message?.content || "";
}

async function callGemini(apiKey: string, prompt: string, imageBase64: string): Promise<string> {
  const model = process.env.OCR_MODEL || "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const base64Data = imageBase64.startsWith("data:") ? imageBase64.split(",")[1] : imageBase64;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64Data } }] }],
      generationConfig: { maxOutputTokens: 4096, temperature: 0.1 },
    }),
  });
  if (!response.ok) {
    const errorData = await response.text();
    console.error("Erro na API Gemini:", errorData);
    throw new Error("Erro ao processar imagem na API Gemini");
  }
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callOpenAICompatible(baseUrl: string, apiKey: string, model: string, prompt: string, imageBase64: string): Promise<string> {
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}` } },
      ] }],
      max_tokens: 4096, temperature: 0.1,
    }),
  });
  if (!response.ok) {
    const errorData = await response.text();
    console.error("Erro na API OpenAI:", errorData);
    throw new Error("Erro ao processar imagem na API de OCR");
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

function parseBrazilianNumber(str: string): number {
  if (!str) return 0;
  let s = str.trim();
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  return parseFloat(s) || 0;
}

function cleanItemName(name: string): string {
  let cleaned = name.replace(/\s+(UN|KG|L|G|ML)\s*$/i, "");
  cleaned = cleaned.replace(/^\d+\s+/, "");
  return cleaned.trim();
}

function parseInvoiceText(rawText: string): InvoiceData {
  let text = rawText;

  text = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
  text = text.replace(/^\s*\{\s*$/m, "").replace(/^\s*\}\s*$/m, "");

  const lines = text.split("\n")
    .map((l) => {
      let line = l.trim();
      line = line.replace(/^"(.*)"[,]?$/, "$1");
      line = line.replace(/^"(.*)"$/, "$1");
      return line.trim();
    })
    .filter(Boolean);

  let storeName = "Desconhecido";
  let cnpj: string | undefined;
  let date: string | undefined;
  let total = 0;
  let paymentMethod: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const cn = line.match(/CNPJ[:\s-]*(\d[\d.\-\/]+)/i);
    if (cn) cnpj = cn[1].replace(/[.\/-]/g, "");

    if (line.match(/CENCOSUD|CENCDSUD|BRASIL.*COMERCIAL|RAZAO\s+SOCIAL|RAZ[AÃ]O/i) && line.length > 5) {
      storeName = line.replace(/\s+/g, " ").trim();
    }

    const dateMatch = line.match(/(\d{2})[\/.-](\d{2})[\/.-](\d{4})/);
    if (dateMatch && !date) date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;

    const totalLabel = line.match(/(?:VALOR\s+(?:TOTAL|A\s+PAGAR))\s*R?\$?/i);
    if (totalLabel && i + 1 < lines.length) {
      const p = parseBrazilianNumber(lines[i + 1]);
      if (p > total) total = p;
    }
    const totalSingle = line.match(/(?:VALOR\s+(?:TOTAL|A\s+PAGAR)|TOTAL)\s*R?\$?\s*([\d.,]+)/i);
    if (totalSingle) {
      const p = parseBrazilianNumber(totalSingle[1]);
      if (p > total) total = p;
    }

    const paymentMatch = line.match(/(Cart[aã]o\s+\w+|D[eé]bito|Cr[eé]dito|PIX|Dinheiro|TEF|Debito)/i);
    if (paymentMatch) paymentMethod = paymentMatch[1];
  }

  const items: InvoiceData["items"] = [];

  const pMultiQty = /^(\d{3})\s+(\d+)\s+(.+?)\s+(UN|KG|L|G|ML)\s+(\d+[.,]?\d*)\s+(UN|KG|L|G|ML)\s*x\s*([\d.,]+)\s+([\d.,]+)$/i;
  const pShort = /^(\d{3})\s+(\d+)\s+(.+?)\s+(UN|KG|L|G|ML)\s+(UN|KG|L|G|ML)\s+([\d.,]+)$/i;

  for (const line of lines) {
    let m = line.match(pMultiQty);
    if (m) {
      const name = cleanItemName(m[3]);
      const unit = m[4].toLowerCase();
      const quantity = parseBrazilianNumber(m[5]);
      const unitPrice = parseBrazilianNumber(m[7]);
      const totalPrice = parseBrazilianNumber(m[8]);
      items.push({ productName: name, name, quantity, unit, unitPrice, totalPrice });
      continue;
    }

    m = line.match(pShort);
    if (m) {
      const name = cleanItemName(m[3]);
      const unit = m[4].toLowerCase();
      const totalPrice = parseBrazilianNumber(m[6]);
      items.push({ productName: name, name, quantity: 1, unit, unitPrice: totalPrice, totalPrice });
    }
  }

  return { storeName, cnpj, date, total, items, paymentMethod };
}

export async function extractInvoiceData(imageBase64: string, extraInstructions?: string): Promise<InvoiceData> {
  const ollamaUrl = process.env.OLLAMA_URL;
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const openaiEndpoint = process.env.OCR_API_ENDPOINT;
  const ocrModel = process.env.OCR_MODEL;
  const prompt = buildExtractionPrompt(extraInstructions);

  let content = "";
  if (ollamaUrl) {
    content = await callOllama(ollamaUrl, ocrModel || "GLM-OCR", prompt, imageBase64);
  } else if (geminiKey) {
    content = await callGemini(geminiKey, prompt, imageBase64);
  } else if (openaiKey) {
    content = await callOpenAICompatible(openaiEndpoint || "https://api.openai.com", openaiKey, ocrModel || "gpt-4o", prompt, imageBase64);
  } else {
    throw new Error("Nenhuma API de OCR configurada");
  }

  if (!content) throw new Error("Resposta vazia da API de OCR");

  return parseInvoiceText(content);
}

export function validateInvoiceData(data: InvoiceData): string[] {
  const errors: string[] = [];
  if (!data.storeName) errors.push("Nome do estabelecimento nao identificado");
  if (data.total <= 0) errors.push("Valor total nao identificado");
  if (data.items.length === 0) errors.push("Nenhum item identificado na nota fiscal");
  data.items.forEach((item, index) => {
    if (!item.name) errors.push(`Item ${index + 1}: nome nao identificado`);
    if (item.totalPrice <= 0) errors.push(`Item ${index + 1}: preco invalido`);
  });
  return errors;
}
