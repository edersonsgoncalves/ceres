export const INVOICE_EXTRACTION_PROMPT = `Extraia TODO o texto desta imagem de nota fiscal de supermercado.
Retorne APENAS o texto puro como ele aparece na imagem, sem formatacao JSON, sem aspas, sem chaves, sem explicações.
Inclua todos os itens, preços, quantidade, total, nome da loja, CNPJ e data.
Preserve a formatacao original da nota fiscal.`;

export function buildExtractionPrompt(extraInstructions?: string): string {
  let prompt = INVOICE_EXTRACTION_PROMPT;
  if (extraInstructions) {
    prompt += `\n\nInstruções adicionais: ${extraInstructions}`;
  }
  return prompt;
}
