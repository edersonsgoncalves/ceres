"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Html5Qrcode } from "html5-qrcode";

interface Product {
  productName: string;
  maxPrice: number;
  minPrice: number;
  lastPurchase: string | Date | null;
  lastStore: string;
  purchaseCount: number;
  category: string | null;
  barcode: string | null;
  eanPrefix?: string | null;
}

interface EanGroup {
  eanPrefix: string;
  groupName: string;
  products: Product[];
  stats: {
    totalPurchases: number;
    avgPrice: number;
    totalSpent: number;
  };
}

function buildEanGroups(products: Product[]): EanGroup[] {
  const eanMap = new Map<string, Map<string, Product>>();

  for (const p of products) {
    const prefix = (p as Record<string, unknown>).eanPrefix as string || `_no_${p.productName}`;
    const existing = eanMap.get(prefix);
    if (existing) {
      existing.set(p.productName, p);
    } else {
      eanMap.set(prefix, new Map([[p.productName, p]]));
    }
  }

  const groups: EanGroup[] = [];
  for (const [prefix, prods] of eanMap) {
    const productArray = Array.from(prods.values());
    const isNoEan = prefix.startsWith("_no_");
    const totalPurchases = productArray.reduce((s, p) => s + p.purchaseCount, 0);
    const totalSpent = productArray.reduce((s, p) => s + p.maxPrice * p.purchaseCount, 0);

    groups.push({
      eanPrefix: isNoEan ? "" : prefix,
      groupName: isNoEan
        ? productArray[0]?.productName ?? ""
        : deriveGroupName(productArray.map((p) => p.productName)),
      products: productArray.sort((a, b) => b.purchaseCount - a.purchaseCount),
      stats: { totalPurchases, avgPrice: totalSpent / (totalPurchases || 1), totalSpent },
    });
  }

  return groups.sort((a, b) => b.stats.totalPurchases - a.stats.totalPurchases);
}

function deriveGroupName(names: string[]): string {
  if (names.length === 1) return names[0];
  const normalized = names.map((n) =>
    n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
  );
  const words = normalized[0].split(/\s+/);
  let prefix = "";
  for (let i = 0; i < words.length; i++) {
    const candidate = prefix ? `${prefix} ${words[i]}` : words[i];
    if (normalized.every((n) => n.startsWith(candidate))) {
      prefix = candidate;
    } else {
      break;
    }
  }
  return prefix || names[0];
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [eanGroups, setEanGroups] = useState<EanGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({ search: q.trim() });
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      const allProducts: Product[] = data.products || [];
      setEanGroups(buildEanGroups(allProducts));
    } catch {
      setEanGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = async () => { await doSearch(query); };

  const startScanning = async () => {
    try {
      const scanner = new Html5Qrcode("barcode-reader");
      scannerRef.current = scanner;
      setScanning(true);
      setScanStatus("Abrindo camera...");

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 300, height: 150 }, aspectRatio: 2.0 },
        async (decodedText) => {
          await stopScanning();
          setQuery(decodedText);
          setScanStatus(`Codigo detectado: ${decodedText}`);
          await doSearch(decodedText);
        },
        () => {}
      );

      setScanStatus("Camera ativa — aponte para o codigo de barras");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao acessar camera";
      setScanStatus(`Erro: ${msg}`);
      setScanning(false);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => { scannerRef.current?.stop().catch(() => {}); };
  }, []);

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4 pt-8">
        <h1 className="text-4xl font-bold">Ceres</h1>
        <p className="text-lg text-gray-500 dark:text-gray-400">
          Compare precos de produtos entre estabelecimentos
        </p>
      </div>

      <div className="mx-auto max-w-xl space-y-3">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Buscar por nome do produto..."
            className="flex-1 text-base"
          />
          <Button onClick={handleSearch} disabled={loading} size="lg">
            {loading ? "Buscando..." : "Buscar"}
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant={scanning ? "destructive" : "outline"}
            onClick={scanning ? stopScanning : startScanning}
            className="flex-1"
          >
            {scanning ? "Parar Camera" : "Ler Codigo de Barras"}
          </Button>
        </div>

        <div id="barcode-reader" className="rounded-lg overflow-hidden" style={{ display: scanning ? "block" : "none" }} />
        {scanStatus && (
          <p className={`text-sm ${scanStatus.startsWith("Erro") ? "text-red-500" : "text-gray-600 dark:text-gray-400"}`}>
            {scanStatus}
          </p>
        )}

        <div className="text-center">
          <Link
            href="/login"
            className="text-sm text-gray-500 dark:text-gray-400 hover:underline"
          >
            Entrar para acessar todas as funcionalidades
          </Link>
        </div>
      </div>

      {loading && (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          Buscando produtos...
        </div>
      )}

      {!loading && hasSearched && eanGroups.length === 0 && (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          Nenhum produto encontrado para &quot;{query}&quot;
        </div>
      )}

      {!loading && eanGroups.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Resultados ({eanGroups.length} {eanGroups.length === 1 ? "grupo" : "grupos"})
          </h2>
          {eanGroups.map((group) => (
            <div key={group.eanPrefix || group.groupName} className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="min-w-0">
                  <h3 className="font-medium truncate">{group.groupName}</h3>
                  {group.eanPrefix && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">EAN: {group.eanPrefix}*</p>
                  )}
                </div>
                {group.products.length > 1 && (
                  <span className="text-xs bg-gray-100 dark:bg-neutral-800 px-2 py-1 rounded whitespace-nowrap ml-2">
                    {group.products.length} variantes
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {group.products.map((product) => (
                  <div
                    key={product.productName}
                    className="flex items-center justify-between rounded p-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{product.productName}</p>
                      {product.category && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{product.category}</p>
                      )}
                    </div>
                    <div className="text-right text-sm ml-3 shrink-0">
                      <div className="flex gap-2">
                        <span className="text-green-600 dark:text-green-400">R$ {product.minPrice.toFixed(2)}</span>
                        <span className="text-red-600 dark:text-red-400">R$ {product.maxPrice.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {product.purchaseCount}x
                        {product.lastStore && ` — ${product.lastStore}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-2 pt-2 border-t flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{group.stats.totalPurchases} compras</span>
                <span>R$ {group.stats.totalSpent.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
