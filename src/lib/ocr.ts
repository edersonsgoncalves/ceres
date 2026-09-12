import { InvoiceData } from "@/types/invoice";
import { buildExtractionPrompt } from "./prompts";

function cleanBase64(imageBase64: string): string {
  return imageBase64.startsWith("data:") ? imageBase64.split(",")[1] : imageBase64;
}

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 2000): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.warn(`Tentativa ${attempt + 1} falhou, retry em ${Math.round(delay)}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("Max retries exceeded");
}

async function callOllama(baseUrl: string, model: string, prompt: string, images: string[]): Promise<string> {
  const base64Images = images.map(cleanBase64);
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt, images: base64Images }],
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

async function callGemini(apiKey: string, prompt: string, images: string[]): Promise<string> {
  const model = process.env.OCR_MODEL || "gemini-3.6-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [
    { text: prompt },
  ];
  for (const img of images) {
    parts.push({ inline_data: { mime_type: "image/jpeg", data: cleanBase64(img) } });
  }

  return retryWithBackoff(async () => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          maxOutputTokens: 16384,
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    });
    if (!response.ok) {
      const errorData = await response.text();
      console.error("Erro na API Gemini:", errorData);
      const parsed = JSON.parse(errorData).error;
      if (parsed?.code === 503 || parsed?.code === 429) {
        throw new Error(`Gemini ${parsed.code}: ${parsed.message}`);
      }
      throw new Error("Erro ao processar imagem na API Gemini");
    }
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  });
}

async function callOpenAICompatible(baseUrl: string, apiKey: string, model: string, prompt: string, images: string[]): Promise<string> {
  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: "text", text: prompt },
  ];
  for (const img of images) {
    const url = img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}`;
    content.push({ type: "image_url", image_url: { url } });
  }

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      max_tokens: 4096,
      temperature: 0.1,
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

function tryRepairJson(text: string): string {
  let s = text.trim();

  const openBrackets = (s.match(/\[/g) || []).length;
  const closeBrackets = (s.match(/\]/g) || []).length;
  const openBraces = (s.match(/\{/g) || []).length;
  const closeBraces = (s.match(/\}/g) || []).length;

  if (openBrackets > closeBrackets) {
    for (let i = 0; i < openBrackets - closeBrackets; i++) s += "]";
  }
  if (openBraces > closeBraces) {
    for (let i = 0; i < openBraces - closeBraces; i++) s += "}";
  }

  const lastChar = s[s.length - 1];
  if (lastChar === ",") s = s.slice(0, -1);

  return s;
}

function parseInvoiceJson(rawText: string): InvoiceData {
  let text = rawText;

  text = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    let jsonStr = jsonMatch[0];
    try {
      const parsed = JSON.parse(jsonStr);
      const items: InvoiceData["items"] = (parsed.itens || parsed.items || []).map(
        (item: Record<string, unknown>) => ({
          productName: String(item.nome || item.productName || ""),
          name: String(item.nome || item.name || ""),
          quantity: Number(item.qtd || item.quantity || 1),
          unit: String(item.unidade || item.unit || "un").toLowerCase(),
          unitPrice: Number(item.precoUnitario || item.unitPrice || 0),
          totalPrice: Number(item.precoTotal || item.totalPrice || 0),
          category: item.categoria || item.category || undefined,
          barcode: item.codigoBarras || item.barcode || undefined,
        })
      );
      return {
        storeName: String(parsed.storeName || "Loja nao informada"),
        cnpj: parsed.cnpj ? String(parsed.cnpj).replace(/\D/g, "") : undefined,
        date: parsed.data || parsed.date || undefined,
        total: Number(parsed.total || 0),
        items,
        paymentMethod: parsed.formaPagamento || parsed.paymentMethod || undefined,
      };
    } catch {
      console.warn("JSON invalido, tentando reparar...");
      try {
        jsonStr = tryRepairJson(jsonStr);
        const parsed = JSON.parse(jsonStr);
        const items: InvoiceData["items"] = (parsed.itens || parsed.items || []).map(
          (item: Record<string, unknown>) => ({
            productName: String(item.nome || item.productName || ""),
            name: String(item.nome || item.name || ""),
            quantity: Number(item.qtd || item.quantity || 1),
            unit: String(item.unidade || item.unit || "un").toLowerCase(),
            unitPrice: Number(item.precoUnitario || item.unitPrice || 0),
            totalPrice: Number(item.precoTotal || item.totalPrice || 0),
            category: item.categoria || item.category || undefined,
            barcode: item.codigoBarras || item.barcode || undefined,
          })
        );
        return {
          storeName: String(parsed.storeName || "Loja nao informada"),
          cnpj: parsed.cnpj ? String(parsed.cnpj).replace(/\D/g, "") : undefined,
          date: parsed.data || parsed.date || undefined,
          total: Number(parsed.total || 0),
          items,
          paymentMethod: parsed.formaPagamento || parsed.paymentMethod || undefined,
        };
      } catch {
        console.warn("Reparo falhou, usando fallback de texto");
      }
    }
  }

  return parseFallbackText(rawText);
}

function parseFallbackText(text: string): InvoiceData {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let storeName = "Desconhecido";
  let cnpj: string | undefined;
  let date: string | undefined;
  let total = 0;
  let paymentMethod: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const cn = line.match(/CNPJ[:\s-]*(\d[\d.\-\/]+)/i);
    if (cn) cnpj = cn[1].replace(/[.\/-]/g, "");

    if (line.match(/RAZAO\s+SOCIAL|RAZ[AÃ]O/i) && line.length > 5) {
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
      const name = m[3].replace(/\s+(UN|KG|L|G|ML)\s*$/i, "").replace(/^\d+\s+/, "").trim();
      const unit = m[4].toLowerCase();
      const quantity = parseBrazilianNumber(m[5]);
      const unitPrice = parseBrazilianNumber(m[7]);
      const totalPrice = parseBrazilianNumber(m[8]);
      items.push({ productName: name, name, quantity, unit, unitPrice, totalPrice });
      continue;
    }

    m = line.match(pShort);
    if (m) {
      const name = m[3].replace(/\s+(UN|KG|L|G|ML)\s*$/i, "").replace(/^\d+\s+/, "").trim();
      const unit = m[4].toLowerCase();
      const totalPrice = parseBrazilianNumber(m[6]);
      items.push({ productName: name, name, quantity: 1, unit, unitPrice: totalPrice, totalPrice });
    }
  }

  return { storeName, cnpj, date, total, items, paymentMethod };
}

export async function extractInvoiceData(images: string[], extraInstructions?: string): Promise<InvoiceData> {
  const ollamaUrl = process.env.OLLAMA_URL;
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const openaiEndpoint = process.env.OCR_API_ENDPOINT;
  const ocrModel = process.env.OCR_MODEL;
  const prompt = buildExtractionPrompt(extraInstructions);

  let content = "";
  if (ollamaUrl) {
    content = await callOllama(ollamaUrl, ocrModel || "GLM-OCR", prompt, images);
  } else if (geminiKey) {
    content = await callGemini(geminiKey, prompt, images);
  } else if (openaiKey) {
    content = await callOpenAICompatible(openaiEndpoint || "https://api.openai.com", openaiKey, ocrModel || "gpt-4o", prompt, images);
  } else {
    throw new Error("Nenhuma API de OCR configurada");
  }

  if (!content) throw new Error("Resposta vazia da API de OCR");

  console.log(`=== OCR Response (${content.length} chars, ends: "${content.slice(-20)}") ===`);
  console.log(content.substring(0, 500));
  console.log("=== End OCR Response ===");

  return parseInvoiceJson(content);
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
