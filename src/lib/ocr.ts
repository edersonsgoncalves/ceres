import { InvoiceData } from "@/types/invoice";
import { buildExtractionPrompt } from "./prompts";

function cleanBase64(imageBase64: string): string {
  return imageBase64.startsWith("data:") ? imageBase64.split(",")[1] : imageBase64;
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
  const model = process.env.OCR_MODEL || "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [
    { text: prompt },
  ];
  for (const img of images) {
    parts.push({ inline_data: { mime_type: "image/jpeg", data: cleanBase64(img) } });
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
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

function parseInvoiceJson(rawText: string): InvoiceData {
  let text = rawText;

  text = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
  text = text.replace(/^\s*\{\s*$/m, "").replace(/^\s*\}\s*$/m, "");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Nenhum JSON encontrado na resposta do OCR");
  }

  const parsed = JSON.parse(jsonMatch[0]);

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
