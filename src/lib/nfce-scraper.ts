import { InvoiceData, InvoiceItem } from "@/types/invoice";
import { chromium, type Browser, type Page } from "playwright-core";
import { existsSync } from "fs";

const CONSULTA_URL = "https://www.fazenda.rj.gov.br/nfce/consulta";

const CHROMIUM_BIN_CANDIDATES = [
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/opt/google/chrome/chrome",
  "/usr/bin/google-chrome",
];

const BROWSER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
];

let browserPromise: Promise<Browser> | null = null;

function detectChromiumBinary(): string | undefined {
  for (const candidate of CHROMIUM_BIN_CANDIDATES) {
    try {
      if (existsSync(candidate)) return candidate;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const executablePath = detectChromiumBinary();
    browserPromise = chromium
      .launch({
        headless: true,
        args: BROWSER_ARGS,
        ...(executablePath ? { executablePath } : {}),
        timeout: 60000,
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getBodyText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const t = document.body ? document.body.innerText : "";
    return t as unknown as string;
  });
}

async function getBodyHtml(page: Page): Promise<string> {
  return page.evaluate(() => {
    const h = document.body ? document.body.innerHTML : "";
    return h as unknown as string;
  });
}

async function getViewState(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.querySelector('input[name="javax.faces.ViewState"]');
    return el ? (el as HTMLInputElement).value : "";
  });
}

async function clickElementByName(page: Page, name: string): Promise<void> {
  await page.evaluate((btnName) => {
    const el = document.querySelector(`[name="${btnName}"]`) as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    ["mousemove", "mousedown", "mouseup"].forEach((type) => {
      el.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y,
        })
      );
    });
    el.click();
  }, name);
}

async function fillAccessKey(page: Page, accessKey: string): Promise<boolean> {
  try {
    await page.waitForSelector('input[id*=chave], input[name*=chave]', {
      timeout: 15000,
    });
    await page.evaluate((key) => {
      const el = document.querySelector(
        'input[id*=chave], input[name*=chave]'
      ) as HTMLInputElement | null;
      if (!el) return;
      el.value = key;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, accessKey);
    return true;
  } catch {
    return false;
  }
}

async function clickConsultar(page: Page): Promise<void> {
  const selector =
    "#consultarBtn, input[type=submit], button[type=submit], input[id*=consultar], button[id*=consultar]";
  try {
    await page.locator(selector).first().click({ force: true, timeout: 5000 });
  } catch {
    await page.evaluate(() => {
      const el = document.querySelector(
        "#consultarBtn, input[type=submit], button[type=submit], input[id*=consultar], button[id*=consultar]"
      ) as HTMLElement | null;
      if (el) el.click();
    });
  }
}

async function findDetailButtonName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const exact = document.querySelector(
      'input[alt="Visualizar NFC-e detalhada"], input[title="Visualizar NFC-e detalhada"], input.imgBtDetalhada'
    ) as HTMLInputElement | null;
    if (exact) return exact.name || "";

    const buttons = Array.from(
      document.querySelectorAll("input[type=image], input[type=button], button")
    ).map((b) => {
      const el = b as HTMLButtonElement | HTMLInputElement;
      return {
        name: (el.name as string) || "",
        alt: (el as HTMLInputElement).alt || "",
        title: (el as HTMLInputElement).title || "",
        value: (el as HTMLInputElement).value || "",
        text: (el.textContent || "").slice(0, 50),
      };
    });

    for (const b of buttons) {
      const val = `${b.alt} ${b.title} ${b.value} ${b.text}`.toLowerCase();
      if (val.includes("detalhad") || val.includes("completa")) return b.name;
    }
    return "";
  });
}

interface PlaywrightScrapeResult {
  ok: boolean;
  text?: string;
  html?: string;
  detailFound?: boolean;
  error?: string;
}

async function runPlaywrightScraper(accessKey: string): Promise<PlaywrightScrapeResult> {
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  try {
    await page.goto(CONSULTA_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

    const filled = await fillAccessKey(page, accessKey);
    if (!filled) {
      throw new Error("Campo da chave de acesso nao encontrado na pagina");
    }

    await sleep(300);
    await clickConsultar(page);

    await page
      .waitForFunction(
        () => document.body && document.body.innerText.includes("DOCUMENTO AUXILIAR"),
        { timeout: 20000 }
      )
      .catch(() => {});

    await sleep(500);

    let text = await getBodyText(page);
    let html = await getBodyHtml(page);
    let prevViewState = await getViewState(page);
    let detailFound = html.includes("fixo-prod-serv-descricao");

    for (let attempt = 0; attempt < 4 && !detailFound; attempt++) {
      const btnName = await findDetailButtonName(page);
      if (!btnName) {
        html = await getBodyHtml(page);
        if (html.includes("fixo-prod-serv-descricao")) {
          detailFound = true;
          break;
        }
        await sleep(300);
        continue;
      }

      await clickElementByName(page, btnName);

      await page
        .waitForFunction(
          (prevState) => {
            const h = document.body ? document.body.innerHTML : "";
            if (h.includes("fixo-prod-serv-descricao")) return true;
            const el = document.querySelector('input[name="javax.faces.ViewState"]');
            const vs = el ? (el as HTMLInputElement).value : "";
            return vs !== "" && vs !== prevState;
          },
          prevViewState,
          { timeout: 15000 }
        )
        .catch(() => {});

      html = await getBodyHtml(page);
      prevViewState = await getViewState(page);

      if (html.includes("fixo-prod-serv-descricao")) {
        detailFound = true;
        break;
      }

      await sleep(300);
    }

    if (!html) html = await getBodyHtml(page);
    text = await getBodyText(page);

    return { ok: true, text, html, detailFound };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Falha ao consultar SEFAZ",
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function scrapeFromSefaz(accessKey: string): Promise<InvoiceData> {
  let lastError = "Falha ao consultar SEFAZ";

  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await runPlaywrightScraper(accessKey);
    if (result.ok) {
      console.log(
        "[SEFAZ] Detail page:", result.detailFound,
        "| text:", (result.text || "").length, "chars",
        "| html:", (result.html || "").length, "chars",
        "| attempt:", attempt
      );
      return parseSefazResponse(result.text || "", result.html || "");
    }

    lastError = result.error || lastError;
    console.warn(`[SEFAZ] attempt ${attempt} failed: ${lastError}`);
    if (attempt < 3) await sleep(2000);
  }

  throw new Error(lastError);
}

export function parseSefazResponse(text: string, html: string): InvoiceData {
  const cleanText = text.replace(/\xa0/g, " ");
  const lines = cleanText.split("\n").map((l) => l.trim()).filter(Boolean);

  let cnpj: string | undefined;
  let date: string | undefined;
  let paymentMethod: string | undefined;
  const items: InvoiceItem[] = [];

  const eanMap = extractEanMap(html);

  const detailItems = extractItemsFromDetailTable(html, eanMap);
  const textItems: InvoiceItem[] = [];

  const storeName =
    detailLabelValue(html, /Nome\s*\/\s*Raz[a\u00e3]o\s*Social<\/label>\s*<span>([^<]+)<\/span>/i) ??
    extractStoreName(lines);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const cnpjMatch = line.match(/CNPJ:\s*([\d./-]+)/i);
    if (cnpjMatch && !cnpj) {
      cnpj = cnpjMatch[1].replace(/[./-]/g, "");
    }

    const dateMatch = line.match(/Emiss[a\u00e3]o:\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (dateMatch && !date) {
      const parts = dateMatch[1].split("/");
      date = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    const itemMatch = line.match(/^(.+?)\s*\(C[o\u00f3]digo:\s*(\d+)\s*\)/i);
    if (itemMatch) {
      const name = itemMatch[1].trim();
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

      textItems.push({
        productName: name,
        name,
        quantity,
        unit,
        unitPrice,
        totalPrice,
        barcode: findBarcode(name, eanMap),
      });
    }
  }

  const finalItems = detailItems.length > 0 ? detailItems : textItems;

  cnpj = cnpj ?? normalizeCnpj(detailLabelValue(html, /CNPJ<\/label>\s*<span>([^<]+)<\/span>/i));

  const detailDate = detailLabelValue(
    html,
    /Data\s+de\s+Emiss[a\u00e3]o<\/label>\s*<span>\s*(\d{2}\/\d{2}\/\d{4})/i
  );
  if (!date && detailDate) {
    const parts = detailDate.split("/");
    date = `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  let total =
    valueAfterLabel(lines, /^Valor a pagar/i) ??
    valueAfterLabel(lines, /^Valor total/i) ??
    parseBrazilianNumber(
      detailLabelValue(
        html,
        /Valor(?:\s|&nbsp;)+Total(?:\s|&nbsp;)+da(?:\s|&nbsp;)+(?:NFe|Nota(?:\s|&nbsp;)+Fiscal)<\/label>\s*<span>([^<]+)<\/span>/i
      ) || ""
    );

  if (total === 0) {
    total = finalItems.reduce((sum, item) => sum + item.totalPrice, 0);
  }

  for (let i = 0; i < lines.length; i++) {
    if (/^Forma de pagamento/i.test(lines[i])) {
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const l = lines[j];
        if (/^[\d.,]+$/.test(l)) continue;
        if (/R\$|^Troco$/i.test(l)) continue;
        paymentMethod = l;
        break;
      }
      break;
    }
  }

  paymentMethod = paymentMethod ?? detailPaymentMethod(html);

  return { storeName, cnpj, date, total, items: finalItems, paymentMethod };
}

function detailPaymentMethod(html: string): string | undefined {
  const idx = html.indexOf("Meio de Pagamento");
  if (idx === -1) return undefined;
  const section = html.slice(idx, idx + 3000);
  const re = /<span>\s*(\d+\s*-\s*[^<]{2,50})<\/span>/gi;
  let m;
  let count = 0;
  while ((m = re.exec(section)) !== null) {
    count++;
    if (count === 2) return m[1].replace(/\s+/g, " ").trim();
  }
  return undefined;
}

function detailLabelValue(html: string, labelRe: RegExp): string | null {
  const m = html.match(labelRe);
  if (!m) return null;
  const value = m[1].replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
  return value.length > 0 ? value : null;
}

function normalizeCnpj(value: string | null): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/[./-]/g, "");
  return digits.length >= 8 ? digits : undefined;
}

function extractStoreName(lines: string[]): string {
  for (let i = 0; i < lines.length; i++) {
    if (/^DOCUMENTO AUXILIAR DA NOTA/i.test(lines[i])) {
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const candidate = lines[j];
        if (candidate.length > 3 && !/^(CNPJ|CPF)/i.test(candidate)) return candidate;
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    if (/^CNPJ:/i.test(lines[i])) {
      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        const candidate = lines[j];
        if (
          candidate.length > 3 &&
          !isAddressLine(candidate) &&
          !/^(DOCUMENTO|DA NOTA|CNPJ|Dados)/i.test(candidate)
        ) {
          return candidate;
        }
      }
    }
  }

  return "Desconhecido";
}

function isAddressLine(line: string): boolean {
  return (
    /^(Estrada|Rua|Avenida|Av\.|Travessa|Tv\.|Rodovia|Rod\.|Alameda|Al\.|Quadra|Lote|Km|S\/n)/i.test(line) ||
    /\s,\s\d+/.test(line) ||
    /CEP/i.test(line)
  );
}

function extractEanMap(html: string): Map<string, string> {
  const eanMap = new Map<string, string>();

  const descRe = /fixo-prod-serv-descricao[^>]*>\s*<span[^>]*>([^<]+)<\/span>/gi;
  const products: { name: string; idx: number }[] = [];
  let m;
  while ((m = descRe.exec(html)) !== null) {
    const name = m[1].trim().toUpperCase();
    if (!name || name.includes("DESCRI")) continue;
    products.push({ name, idx: m.index });
  }
  if (products.length === 0) return eanMap;

  const eanRe = /C[o\u00f3]digo EAN Comercial\s*<\/label>\s*<span[^>]*>([^<]*)<\/span>/gi;
  while ((m = eanRe.exec(html)) !== null) {
    const ean = m[1].trim();
    if (!/^\d{8,14}$/.test(ean)) continue;

    let best: { name: string; dist: number } | null = null;
    for (const p of products) {
      const dist = m.index - p.idx;
      if (dist < 0 || dist > 4000) continue;
      if (!best || dist < best.dist) best = { name: p.name, dist };
    }
    if (best && !eanMap.has(best.name)) eanMap.set(best.name, ean);
  }

  return eanMap;
}

function extractItemsFromDetailTable(html: string, eanMap: Map<string, string>): InvoiceItem[] {
  const rowRe = /fixo-prod-serv-descricao[^>]*>\s*<span[^>]*>([^<]+)<\/span>\s*<\/td>\s*<td class="fixo-prod-serv-qtd"[^>]*>\s*<span[^>]*>([^<]+)<\/span>\s*<\/td>\s*<td class="fixo-prod-serv-uc"[^>]*>\s*<span[^>]*>([^<]+)<\/span>\s*<\/td>\s*<td class="fixo-prod-serv-vb"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/gi;

  const items: InvoiceItem[] = [];
  let m;
  while ((m = rowRe.exec(html)) !== null) {
    const name = m[1].trim();
    const quantity = parseBrazilianNumber(m[2]);
    const unit = m[3].trim().toLowerCase() || "un";
    const totalPrice = parseBrazilianNumber(m[4]);
    if (!name || quantity <= 0 || totalPrice <= 0) continue;

    const unitPrice = Math.round((totalPrice / quantity) * 100) / 100;
    items.push({
      productName: name,
      name,
      quantity,
      unit,
      unitPrice,
      totalPrice,
      barcode: eanMap.get(name.toUpperCase()),
    });
  }
  return items;
}

function findBarcode(name: string, eanMap: Map<string, string>): string | undefined {
  const normalized = name.toUpperCase().trim();
  const exact = eanMap.get(normalized);
  if (exact) return exact;

  let best: { ean: string; score: number } | undefined;
  for (const [key, ean] of eanMap) {
    const score = commonPrefixLength(normalized, key);
    if (score >= 15 && (!best || score > best.score)) best = { ean, score };
  }
  return best?.ean;
}

function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function valueAfterLabel(lines: string[], labelRe: RegExp): number | null {
  for (let i = 0; i < lines.length; i++) {
    if (!labelRe.test(lines[i])) continue;
    for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j++) {
      if (/^[\d.,]+$/.test(lines[j])) return parseBrazilianNumber(lines[j]);
    }
  }
  return null;
}

function parseBrazilianNumber(str: string): number {
  if (!str) return 0;
  let s = str.trim();
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return parseFloat(s) || 0;
}