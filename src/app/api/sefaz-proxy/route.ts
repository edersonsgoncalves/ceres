import { NextResponse } from "next/server";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "identity",
};

function extractFormInfo(html: string): { action: string; viewState: string; formName: string } | null {
  const actionMatch = html.match(/<form[^>]+action="([^"]+)"[^>]*>/i);
  const action = actionMatch ? actionMatch[1].replace(/&amp;/g, "&") : "";

  const vsMatch = html.match(/<input[^>]+name="javax\.faces\.ViewState"[^>]+value="([^"]*)"/i);
  const viewState = vsMatch ? vsMatch[1] : "";

  const formMatch = html.match(/<form[^>]+name="([^"]+)"[^>]*>/i);
  const formName = formMatch ? formMatch[1] : "j_idt6";

  if (!viewState) return null;
  return { action, viewState, formName };
}

function extractSubmitButton(html: string): { name: string; id: string } | null {
  const btnMatch = html.match(/<input[^>]+id="(btSubmitQRCode)"[^>]*>/i);
  if (btnMatch) return { name: "btSubmitQRCode", id: "btSubmitQRCode" };

  const btnMatch2 = html.match(/<input[^>]+id="(j_idt\d+)"[^>]*type="submit"/i);
  if (btnMatch2) return { name: btnMatch2[1], id: btnMatch2[1] };

  return null;
}

function extractDetailButton(html: string): { name: string; id: string } | null {
  const candidates = html.matchAll(/<input[^>]+(image|submit|button)[^>]*>/gi);
  for (const match of candidates) {
    const tag = match[0];
    const alt = tag.match(/alt="([^"]*)"/i)?.[1] || "";
    const title = tag.match(/title="([^"]*)"/i)?.[1] || "";
    const value = tag.match(/value="([^"]*)"/i)?.[1] || "";
    const name = tag.match(/name="([^"]*)"/i)?.[1] || "";
    const id = tag.match(/id="([^"]*)"/i)?.[1] || "";
    const hay = `${alt} ${title} ${value} ${name}`.toLowerCase();

    if (/(detalhad|completa|versao|versão)/.test(hay)) {
      return { name, id };
    }
  }
  return null;
}

function extractSessionId(response: Response, html: string): string {
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    const jsessionMatch = setCookie.match(/JSESSIONID=([^;]+)/i);
    if (jsessionMatch) return jsessionMatch[1];
  }
  const htmlMatch = html.match(/jsessionid=([a-zA-Z0-9]+)/i);
  return htmlMatch ? htmlMatch[1] : "";
}

async function fetchWithCookies(url: string, cookies: string): Promise<Response> {
  return fetch(url, {
    headers: { ...HEADERS, Cookie: cookies },
    redirect: "follow",
  });
}

async function postForm(
  baseUrl: string,
  action: string,
  viewState: string,
  buttonName: string,
  cookies: string
): Promise<Response> {
  const formUrl = new URL(action, baseUrl).toString();
  const formData = new URLSearchParams();
  formData.append(buttonName, buttonName);
  formData.append("javax.faces.ViewState", viewState);

  return fetch(formUrl, {
    method: "POST",
    headers: {
      ...HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookies,
      Referer: baseUrl,
    },
    body: formData.toString(),
    redirect: "follow",
  });
}

function extractCookies(existingCookies: string, ...responses: Response[]): string {
  const cookieMap = new Map<string, string>();

  for (const pair of existingCookies.split(";")) {
    const [name, ...rest] = pair.split("=");
    if (name && rest.length) cookieMap.set(name.trim(), rest.join("=").trim());
  }

  for (const res of responses) {
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      const pairs = setCookie.split(",");
      for (const pair of pairs) {
        const [name, ...rest] = pair.split("=");
        const value = rest.join("=").split(";")[0].trim();
        if (name && value) cookieMap.set(name.trim(), value);
      }
    }
  }
  return Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body as { url: string };

    if (!url) {
      return NextResponse.json({ error: "URL e obrigatoria" }, { status: 400 });
    }

    console.log("[SEFAZ] Step 1: Fetching initial page:", url);

    const initialResponse = await fetch(url, { headers: HEADERS, redirect: "follow" });
    if (!initialResponse.ok) {
      return NextResponse.json({ error: `SEFAZ retornou HTTP ${initialResponse.status}` }, { status: 502 });
    }

    let html = await initialResponse.text();
    let cookies = extractCookies("", initialResponse);
    const baseUrl = new URL(url).origin;

    console.log("[SEFAZ] Step 1: Response length:", html.length);

    const formInfo = extractFormInfo(html);
    if (!formInfo) {
      console.log("[SEFAZ] No form found, trying to parse as final page");
      return NextResponse.json({ html });
    }

    console.log("[SEFAZ] Step 2: Submitting form:", formInfo.formName, "action:", formInfo.action);

    const submitBtn = extractSubmitButton(html) || { name: "j_idt6", id: "j_idt6" };
    const postResponse1 = await postForm(baseUrl, formInfo.action, formInfo.viewState, submitBtn.name, cookies);
    cookies = extractCookies(cookies, postResponse1);

    html = await postResponse1.text();
    console.log("[SEFAZ] Step 2: Response length:", html.length);

    const hasItems = html.includes("fixo-prod-serv-descricao") ||
                     html.includes("DOCUMENTO AUXILIAR") ||
                     (html.includes("CNPJ") && html.length > 500);

    if (hasItems) {
      console.log("[SEFAZ] Items found on page");
      return NextResponse.json({ html });
    }

    const formInfo2 = extractFormInfo(html);
    if (formInfo2) {
      const detailBtn = extractDetailButton(html);
      if (detailBtn) {
        console.log("[SEFAZ] Step 3: Clicking detail button:", detailBtn.name);
        const postResponse2 = await postForm(baseUrl, formInfo2.action, formInfo2.viewState, detailBtn.name, cookies);
        cookies = extractCookies(cookies, postResponse2);
        html = await postResponse2.text();
        console.log("[SEFAZ] Step 3: Response length:", html.length);
      } else {
        console.log("[SEFAZ] Step 3: Submitting form again (no detail button found)");
        const postResponse2 = await postForm(baseUrl, formInfo2.action, formInfo2.viewState, submitBtn.name, cookies);
        cookies = extractCookies(cookies, postResponse2);
        html = await postResponse2.text();
        console.log("[SEFAZ] Step 3: Response length:", html.length);
      }
    }

    return NextResponse.json({ html });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[SEFAZ] Error:", msg);
    return NextResponse.json({ error: `Falha ao acessar SEFAZ: ${msg}` }, { status: 502 });
  }
}
