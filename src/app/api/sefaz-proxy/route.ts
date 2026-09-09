import { NextResponse } from "next/server";

async function retryFetch(url: string, maxRetries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        },
      });
      clearTimeout(timeout);
      return response;
    } catch (err) {
      clearTimeout(timeout);
      if (attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw new Error("Max retries exceeded");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body as { url: string };

    if (!url) {
      return NextResponse.json({ error: "URL e obrigatoria" }, { status: 400 });
    }

    if (!url.includes("fazenda.") && !url.includes("sefaz.") && !url.includes("consultaNFCe")) {
      return NextResponse.json({ error: "URL invalida" }, { status: 400 });
    }

    console.log("[SEFAZ-Proxy] Fetching:", url);

    const response = await retryFetch(url);

    if (!response.ok) {
      console.error("[SEFAZ-Proxy] HTTP error:", response.status);
      return NextResponse.json({ error: `SEFAZ retornou HTTP ${response.status}` }, { status: 502 });
    }

    const html = await response.text();
    console.log("[SEFAZ-Proxy] Response length:", html.length);

    return NextResponse.json({ html });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[SEFAZ-Proxy] Error:", msg);
    return NextResponse.json({ error: `Falha ao acessar SEFAZ: ${msg}` }, { status: 502 });
  }
}
