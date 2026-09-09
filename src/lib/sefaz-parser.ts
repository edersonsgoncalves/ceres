import { InvoiceData, InvoiceItem } from "@/types/invoice";

function parseBrazilianNumber(str: string): number {
  if (!str) return 0;
  let s = str.trim();
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  return parseFloat(s) || 0;
}

function cleanHtml(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSefazHtml(html: string): InvoiceData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const body = doc.body;

  let storeName = "Desconhecido";
  let cnpj: string | undefined;
  let date: string | undefined;
  let total = 0;
  let paymentMethod: string | undefined;
  const items: InvoiceItem[] = [];

  const allText = body.innerText || body.textContent || "";
  const lines = allText.split("\n").map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const cnpjMatch = line.match(/CNPJ:\s*([\d./-]+)/i);
    if (cnpjMatch && !cnpj) {
      cnpj = cnpjMatch[1].replace(/[./-]/g, "");
    }

    const dateMatch = line.match(/Emiss[aã]o:\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (dateMatch && !date) {
      const parts = dateMatch[1].split("/");
      date = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    if (/^DOCUMENTO AUXILIAR DA NOTA/i.test(line)) {
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const candidate = lines[j];
        if (candidate.length > 3 && !/^(CNPJ|CPF)/i.test(candidate)) {
          storeName = candidate;
          break;
        }
      }
    }

    if (/^CNPJ:/i.test(line) && !storeName) {
      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        const candidate = lines[j];
        if (candidate.length > 3 && !/^(DOCUMENTO|DA NOTA|CNPJ|Dados)/i.test(candidate)) {
          storeName = candidate;
          break;
        }
      }
    }

    const totalMatch = line.match(/(?:Valor\s+(?:Total|a\s+Pagar))\s*R?\$?\s*([\d.,]+)/i);
    if (totalMatch) {
      const p = parseBrazilianNumber(totalMatch[1]);
      if (p > total) total = p;
    }

    if (/^Forma de pagamento/i.test(line)) {
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const l = lines[j];
        if (/^[\d.,]+$/.test(l)) continue;
        if (/R\$|^Troco$/i.test(l)) continue;
        paymentMethod = l;
        break;
      }
    }
  }

  const descElements = body.querySelectorAll('[class*="prod-serv-descricao"] span, [class*="descricao"] span');
  const eanElements = body.querySelectorAll('[class*="ean"] span, [class*="codigo-ean"] span');

  const eanMap = new Map<string, string>();
  const eanArray: string[] = [];
  eanElements.forEach((el) => {
    const text = el.textContent?.trim() || "";
    if (/^\d{8,14}$/.test(text)) eanArray.push(text);
  });

  const productNames: string[] = [];
  descElements.forEach((el) => {
    const text = el.textContent?.trim() || "";
    if (text && !/DESCRI/i.test(text)) productNames.push(text.toUpperCase());
  });

  for (let i = 0; i < Math.min(productNames.length, eanArray.length); i++) {
    eanMap.set(productNames[i], eanArray[i]);
  }

  const rows = body.querySelectorAll('tr');
  rows.forEach((row) => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 4) {
      const name = cells[0]?.textContent?.trim() || "";
      const qtyText = cells[1]?.textContent?.trim() || "1";
      const unitText = cells[2]?.textContent?.trim() || "un";
      const totalText = cells[3]?.textContent?.trim() || "0";

      if (name && !/^(Produto|Descri|Código)/i.test(name)) {
        const quantity = parseBrazilianNumber(qtyText);
        const unit = unitText.toLowerCase() || "un";
        const totalPrice = parseBrazilianNumber(totalText);
        const unitPrice = quantity > 0 ? Math.round((totalPrice / quantity) * 100) / 100 : totalPrice;

        const normalizedName = name.toUpperCase();
        let barcode: string | undefined;
        for (const [key, ean] of eanMap) {
          if (normalizedName.includes(key) || key.includes(normalizedName)) {
            barcode = ean;
            break;
          }
        }

        if (name && totalPrice > 0) {
          items.push({
            productName: name,
            name,
            quantity,
            unit,
            unitPrice,
            totalPrice,
            barcode,
          });
        }
      }
    }
  });

  if (items.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(.+?)\s*\(C[oó]digo:\s*(\d+)\s*\)/i);
      if (!match) continue;

      const name = match[1].trim();
      let quantity = 1;
      let unit = "un";
      let unitPrice = 0;
      let totalPrice = 0;

      const detailLine = (i + 1 < lines.length) ? lines[i + 1] : "";

      const qtyMatch = detailLine.match(/Qtde\.:\s*([\d.,]+)/);
      if (qtyMatch) quantity = parseBrazilianNumber(qtyMatch[1]);

      const unitMatch = detailLine.match(/UN:\s*(UN|KG|L|G|ML|LT|CX|PT|SC|DZ)/i);
      if (unitMatch) unit = unitMatch[1].toLowerCase();

      const priceMatch = detailLine.match(/Vl\.\s*Unit\.:\s*([\d.,]+)/);
      if (priceMatch) unitPrice = parseBrazilianNumber(priceMatch[1]);

      if (i + 2 < lines.length) {
        const priceLine = lines[i + 2];
        if (/^[\d.,]+$/.test(priceLine)) {
          totalPrice = parseBrazilianNumber(priceLine);
        }
      }

      if (totalPrice === 0 && unitPrice > 0) totalPrice = quantity * unitPrice;

      const normalizedName = name.toUpperCase();
      let barcode: string | undefined;
      for (const [key, ean] of eanMap) {
        const score = commonPrefixLength(normalizedName, key);
        if (score >= 15) {
          barcode = ean;
          break;
        }
      }

      items.push({
        productName: name,
        name,
        quantity,
        unit,
        unitPrice,
        totalPrice,
        barcode,
      });
    }
  }

  if (total === 0 && items.length > 0) {
    total = items.reduce((sum, item) => sum + item.totalPrice, 0);
  }

  return { storeName, cnpj, date, total, items, paymentMethod };
}

function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

export async function fetchSefazData(qrUrl: string): Promise<InvoiceData> {
  const response = await fetch(qrUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });

  if (!response.ok) {
    throw new Error(`Erro ao acessar SEFAZ: ${response.status}`);
  }

  const html = await response.text();
  return parseSefazHtml(html);
}
