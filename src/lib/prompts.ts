export const INVOICE_EXTRACTION_PROMPT = `Analise esta(s) imagem(ns) de nota fiscal de supermercado brasileira.

Retorne APENAS um JSON valido (sem markdown, sem \`\`\`) com a seguinte estrutura:
{
  "storeName": "Nome do estabelecimento",
  "cnpj": "CNPJ somente numeros (se visivel)",
  "data": "AAAA-MM-DD",
  "total": 0.00,
  "formaPagamento": "Cartao Credito/Debito/PIX/Dinheiro/etc",
  "itens": [
    {
      "nome": "Nome do produto",
      "qtd": 1,
      "unidade": "un/kg/l/g/ml",
      "precoUnitario": 0.00,
      "precoTotal": 0.00,
      "codigoBarras": "se visivel, senao null",
      "categoria": "Mercearia/Hortifruti/Carne/Laticinio/Bebida/Limpeza/Higiene/Outros"
    }
  ]
}

Regras importantes:
- Se houver multiplas imagens, cruze os dados para aumentar a precisao
- Preco total de cada item = qtd * precoUnitario (arredonde para 2 casas decimais)
- Total da nota = soma de todos os precosTotal dos itens
- Categoria deve ser uma das opcoes acima
- Se nao encontrar algum campo, use null ou string vazia
- Formate numeros com ponto como separador decimal (ex: 25.90)
- Data no formato brasileiro: converter para AAAA-MM-DD`;

export function buildExtractionPrompt(extraInstructions?: string): string {
  let prompt = INVOICE_EXTRACTION_PROMPT;
  if (extraInstructions) {
    prompt += `\n\nInstrucoes adicionais: ${extraInstructions}`;
  }
  return prompt;
}
