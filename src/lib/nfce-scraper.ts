import { InvoiceData, InvoiceItem } from "@/types/invoice";

export async function scrapeNfceFromUrl(url: string): Promise<InvoiceData> {
  const accessKey = extractAccessKey(url);
  if (!accessKey) throw new Error("Nao foi possivel extrair a chave de acesso do QR Code");

  return scrapeFromSefaz(accessKey);
}

function extractAccessKey(url: string): string | null {
  const match = url.match(/chaveAcesso=([\d]+)/i) || url.match(/p=([\d]{44})/i);
  if (match) return match[1];

  const numbers = url.replace(/\D/g, "");
  if (numbers.length === 44) return numbers;

  return null;
}

async function scrapeFromSefaz(accessKey: string): Promise<InvoiceData> {
  const script = `
import time
import json

def read_text():
    try:
        t = js("document.body ? document.body.innerText : ''")
        return str(t) if t else ""
    except:
        return ""

def read_html():
    try:
        h = js("document.body ? document.body.innerHTML : ''")
        return str(h) if h else ""
    except:
        return ""

def get_view_state():
    try:
        v = js("""
            (function(){
                var e = document.querySelector('input[name="javax.faces.ViewState"]');
                return e ? e.value : '';
            })()
        """)
        return str(v) if v else ""
    except:
        return ""

def wait_for(check, timeout, interval=0.4):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            value = check()
            if value:
                return value
        except:
            pass
        time.sleep(interval)
    return ""

def wait_dom_quiet(quiet_for=0.8, timeout=8):
    try:
        js("""
            if (!window.__bhMutCount) {
                window.__bhMutCount = 0;
                var mo = new MutationObserver(function(){ window.__bhMutCount++; });
                mo.observe(document.documentElement, {childList:true, subtree:true, attributes:true});
                window.__bhObserver = mo;
            }
        """)
    except:
        return
    deadline = time.time() + timeout
    last_count = -1
    stable_since = None
    while time.time() < deadline:
        try:
            count = js("window.__bhMutCount || 0")
        except:
            count = last_count
        if count == last_count:
            if stable_since is None:
                stable_since = time.time()
            elif time.time() - stable_since >= quiet_for:
                return
        else:
            stable_since = None
        last_count = count
        time.sleep(0.2)

def force_page_visible():
    try:
        js("""
            try {
                Object.defineProperty(document, 'hidden', {value:false, configurable:true});
                Object.defineProperty(document, 'visibilityState', {value:'visible', configurable:true});
                document.dispatchEvent(new Event('visibilitychange'));
                window.focus();
            } catch(e) {}
        """)
    except:
        pass

def fire_real_click(selector):
    try:
        return bool(js("""
            (function(){
                var el = document.querySelector(%s);
                if (!el) return false;
                var rect = el.getBoundingClientRect();
                var x = rect.left + rect.width/2;
                var y = rect.top + rect.height/2;
                ['mousemove','mousedown','mouseup'].forEach(function(type){
                    var ev = new MouseEvent(type, {
                        bubbles: true, cancelable: true, view: window,
                        clientX: x, clientY: y
                    });
                    el.dispatchEvent(ev);
                });
                el.click();
                return true;
            })()
        """ % json.dumps(selector)))
    except:
        return False

try:
    new_tab('https://www.fazenda.rj.gov.br/nfce/consulta')
    force_page_visible()

    wait_for(lambda: js("!!document.querySelector('input[id*=chave], input[name*=chave]')"), 15)
    force_page_visible()

    js("""
        (function(){
            var el = document.querySelector('input[id*=chave], input[name*=chave]');
            if (!el) return;
            el.value = '${accessKey}';
            el.dispatchEvent(new Event('input', {bubbles:true}));
            el.dispatchEvent(new Event('change', {bubbles:true}));
        })();
    """)

    wait_dom_quiet(0.4, 3)
    fire_real_click("#consultarBtn, input[type=submit], button[type=submit], input[id*=consultar], button[id*=consultar]")

    text = wait_for(lambda: (lambda t: t if 'DOCUMENTO AUXILIAR' in t else "")(read_text()), 20)

    force_page_visible()
    wait_dom_quiet(0.8, 6)

    def find_detail_button():
        try:
            r = js("""
                (function(){
                    var exact = document.querySelector('input[alt="Visualizar NFC-e detalhada"], input[title="Visualizar NFC-e detalhada"], input.imgBtDetalhada');
                    if (exact) return [{name: exact.name || '', alt: exact.alt || '', title: exact.title || '', value: exact.value || '', text: ''}];
                    return Array.from(document.querySelectorAll('input[type=image], input[type=button], button')).map(
                        b => ({name: b.name || '', alt: b.alt || '', title: b.title || '', value: b.value || '', text: (b.textContent || '').slice(0, 50)})
                    );
                })()
            """)
            if r:
                for b in r:
                    val = (b.get('alt','') + ' ' + b.get('title','') + ' ' + b.get('value','') + ' ' + b.get('text','')).lower()
                    if 'detalhad' in val or 'completa' in val:
                        return b.get('name','')
        except:
            pass
        return ""

    html = ""
    prev_view_state = get_view_state()

    for attempt in range(4):
        btn = find_detail_button()
        if not btn:
            html = read_html()
            if 'fixo-prod-serv-descricao' in html:
                break
            wait_dom_quiet(0.5, 3)
            continue

        clicked = fire_real_click('[name="' + btn + '"]')
        if not clicked:
            time.sleep(0.5)
            continue

        def postback_done():
            h = read_html()
            if 'fixo-prod-serv-descricao' in h:
                return h
            vs = get_view_state()
            if vs and vs != prev_view_state:
                return h or " "
            return ""

        html = wait_for(postback_done, 15)
        prev_view_state = get_view_state()

        if html and 'fixo-prod-serv-descricao' in html:
            break

        wait_dom_quiet(0.5, 3)

    if not html:
        html = read_html()

    close_tab()
    print(json.dumps({"ok": True, "text": text, "html": html, "detailFound": bool(html) and 'fixo-prod-serv-descricao' in html}))
except Exception as e:
    try:
        close_tab()
    except:
        pass
    print(json.dumps({"ok": False, "error": str(e)}))
`;

  let lastError: string | undefined;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await runBrowserHarness(script);
    if (result.ok) {
      console.log(
        "[SEFAZ] Detail page:", result.detailFound,
        "| text:", (result.text || "").length, "chars",
        "| html:", (result.html || "").length, "chars",
        "| attempt:", attempt
      );
      return parseSefazResponse(result.text || "", result.html || "");
    }
    lastError = result.error;
    console.warn(`[SEFAZ] attempt ${attempt} failed: ${result.error}`);
    if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
  }

  throw new Error(lastError || "Falha ao consultar SEFAZ");
}

async function runBrowserHarness(
  script: string
): Promise<{ ok: boolean; text?: string; html?: string; error?: string; detailFound?: boolean }> {
  const { execSync } = await import("child_process");
  const fs = await import("fs");
  const os = await import("os");
  const path = await import("path");

  const tmpFile = path.join(os.tmpdir(), `bh_${Date.now()}.py`);
  fs.writeFileSync(tmpFile, script, "utf-8");

  try {
    const cmd = `type "${tmpFile}" | browser-harness`;
    const output = execSync(cmd, {
      timeout: 120000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: false,
    });

    const lines = output.trim().split("\n");
    const jsonLine = lines.find((l) => l.trim().startsWith("{"));
    if (!jsonLine) return { ok: false, error: `No JSON output. Raw: ${output.slice(0, 500)}` };
    return JSON.parse(jsonLine.trim());
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Browser harness failed" };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
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
