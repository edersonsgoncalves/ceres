export const DEFAULT_CATEGORIES = [
  "Hortifrúti",
  "Carnes",
  "Laticínios",
  "Mercearia",
  "Limpeza",
  "Outros",
];

export function suggestCategory(productName: string): string {
  const name = productName.toLowerCase();

  const hortifrutiKeywords = [
    "banana", "maçã", "laranja", "tomate", "cebola", "alho",
    "batata", "cenoura", "brócolis", "alface", "repolho",
    "morango", "uva", "limão", "abacaxi", "manga",
  ];

  const carnesKeywords = [
    "frango", "boi", "porco", "peixe", "sardinha",
    "linguiça", "presunto", "bacon", "costela", "picanha",
    "alcatra", "coxão mole", "acém", "patinho",
  ];

  const laticiniosKeywords = [
    "leite", "queijo", "iogurte", "manteiga", "creme",
    "requeijão", "cottage", "ricota", "mussarela",
    "cheddar", "parmesão", "azeite", "molho",
  ];

  const merceariaKeywords = [
    "arroz", "feijão", "macarrão", "massa", "óleo",
    "açúcar", "sal", "café", "chá", "suco",
    "cereal", "biscoito", "pão", "bolacha", "farinha",
    "conserva", "molho", "ketchup", "mostarda",
  ];

  const limpezaKeywords = [
    "sabão", "detergente", "amaciante", "água sanitária",
    "desinfetante", "esponja", "papel higiênico",
    "sacola", "luva", "vassoura", "rag",
  ];

  if (hortifrutiKeywords.some((kw) => name.includes(kw))) return "Hortifrúti";
  if (carnesKeywords.some((kw) => name.includes(kw))) return "Carnes";
  if (laticiniosKeywords.some((kw) => name.includes(kw))) return "Laticínios";
  if (merceariaKeywords.some((kw) => name.includes(kw))) return "Mercearia";
  if (limpezaKeywords.some((kw) => name.includes(kw))) return "Limpeza";

  return "Outros";
}
