"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Product {
  productName: string;
  maxPrice: number;
  minPrice: number;
  lastPurchase: string | Date | null;
  lastStore: string;
  purchaseCount: number;
  category: string | null;
  barcode: string | null;
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

interface CategoryGroup {
  category: string;
  products: Product[];
  totalPurchases: number;
  totalSpent: number;
}

export default function BuscaPage() {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [eanGroups, setEanGroups] = useState<EanGroup[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [viewMode, setViewMode] = useState<"ean" | "category" | "flat">("category");

  useEffect(() => {
    fetchProducts(undefined, "category");
  }, []);

  const fetchProducts = async (search?: string, mode?: string) => {
    const shouldGroup = mode ?? viewMode;
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (shouldGroup === "ean") params.set("groupBy", "ean");

    try {
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      if (shouldGroup === "ean") {
        setEanGroups(data.groups || []);
        setProducts([]);
        setCategoryGroups([]);
      } else if (shouldGroup === "category") {
        const allProducts: Product[] = data.products || [];
        const catMap = new Map<string, CategoryGroup>();
        for (const p of allProducts) {
          const cat = p.category || "Sem categoria";
          const existing = catMap.get(cat);
          if (existing) {
            existing.products.push(p);
            existing.totalPurchases += p.purchaseCount;
            existing.totalSpent += p.maxPrice * p.purchaseCount;
          } else {
            catMap.set(cat, {
              category: cat,
              products: [p],
              totalPurchases: p.purchaseCount,
              totalSpent: p.maxPrice * p.purchaseCount,
            });
          }
        }
        const groups = Array.from(catMap.values()).sort((a, b) => b.totalPurchases - a.totalPurchases);
        setCategoryGroups(groups);
        setProducts([]);
        setEanGroups([]);
      } else {
        setProducts(data.products || []);
        setEanGroups([]);
        setCategoryGroups([]);
      }
    } catch {
      setProducts([]);
      setEanGroups([]);
      setCategoryGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setHasSearched(true);
    await fetchProducts(query);
    setSearching(false);
  };

  const handleModeChange = async (newMode: "ean" | "category" | "flat") => {
    setViewMode(newMode);
    if (hasSearched) {
      await fetchProducts(query, newMode);
    } else {
      await fetchProducts(undefined, newMode);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Buscar Produtos</h1>
        <p className="text-gray-500 dark:text-gray-400">Compare precos entre estabelecimentos</p>
      </div>

      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Buscar por nome ou codigo de barras..."
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={searching}>
          {searching ? "Buscando..." : "Buscar"}
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => handleModeChange("category")}
          className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
            viewMode === "category"
              ? "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-200"
              : "border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800"
          }`}
        >
          Por Categoria
        </button>
        <button
          onClick={() => handleModeChange("ean")}
          className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
            viewMode === "ean"
              ? "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-200"
              : "border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800"
          }`}
        >
          Por EAN
        </button>
        <button
          onClick={() => handleModeChange("flat")}
          className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
            viewMode === "flat"
              ? "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-200"
              : "border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-800"
          }`}
        >
          Lista
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">Carregando...</div>
      ) : (
        <>
          {viewMode === "category" && categoryGroups.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">
                {hasSearched ? "Resultados" : "Produtos Recentes"} ({categoryGroups.length} categorias)
              </h2>
              {categoryGroups.map((group) => (
                <div key={group.category}>
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
                      {group.category}
                    </h3>
                    <span className="text-xs bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
                      {group.products.length} {group.products.length === 1 ? "produto" : "produtos"}
                    </span>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {group.products.map((product) => (
                      <Link
                        key={product.productName}
                        href={`/produtos/${encodeURIComponent(product.productName)}/revisao`}
                        className="flex items-center justify-between rounded-lg border p-3 hover:shadow-md transition-shadow"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{product.productName}</p>
                          <div className="flex gap-2 text-xs text-gray-400 dark:text-gray-500">
                            <span>{product.purchaseCount}x</span>
                            {product.lastPurchase && (
                              <span>Ult: {new Date(product.lastPurchase).toLocaleDateString("pt-BR")}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-sm ml-3 shrink-0">
                          <div className="flex gap-1.5">
                            <span className="text-green-600 dark:text-green-400">R$ {product.minPrice.toFixed(2)}</span>
                            <span className="text-red-600 dark:text-red-400">R$ {product.maxPrice.toFixed(2)}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {viewMode === "ean" && eanGroups.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">
                {hasSearched ? "Resultados" : "Produtos Recentes"} ({eanGroups.length} grupos)
              </h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {eanGroups.map((group) => (
                  <div key={group.eanPrefix || group.groupName} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="min-w-0">
                        <h3 className="font-medium truncate">{group.groupName}</h3>
                        {group.eanPrefix && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">EAN: {group.eanPrefix}*</p>
                        )}
                      </div>
                      <span className="text-xs bg-gray-100 dark:bg-neutral-800 px-2 py-1 rounded whitespace-nowrap ml-2">
                        {group.products.length} {group.products.length === 1 ? "variante" : "variantes"}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {group.products.map((product) => (
                        <Link
                          key={product.productName}
                          href={`/produtos/${encodeURIComponent(product.productName)}/revisao`}
                          className="flex items-center justify-between rounded p-2 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{product.productName}</p>
                            {product.category && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{product.category}</p>
                            )}
                          </div>
                          <div className="text-right text-sm ml-2">
                            <div className="flex gap-2">
                              <span className="text-green-600 dark:text-green-400">R$ {product.minPrice.toFixed(2)}</span>
                              <span className="text-red-600 dark:text-red-400">R$ {product.maxPrice.toFixed(2)}</span>
                            </div>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{product.purchaseCount}x</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{group.stats.totalPurchases} compras</span>
                      <span>R$ {group.stats.totalSpent.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === "flat" && products.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">
                {hasSearched ? "Resultados" : "Produtos Recentes"} ({products.length})
              </h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                  <Link
                    key={product.productName}
                    href={`/produtos/${encodeURIComponent(product.productName)}/revisao`}
                    className="rounded-lg border p-4 hover:shadow-md transition-shadow"
                  >
                    <p className="font-medium truncate">{product.productName}</p>
                    {product.category && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{product.category}</p>
                    )}
                    {product.barcode && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">EAN: {product.barcode}</p>
                    )}
                    <div className="mt-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Max:</span>
                        <span className="font-medium text-red-600 dark:text-red-400">R$ {product.maxPrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Min:</span>
                        <span className="font-medium text-green-600 dark:text-green-400">R$ {product.minPrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                        <span>{product.purchaseCount} compras</span>
                        {product.lastPurchase && (
                          <span>Ult: {new Date(product.lastPurchase).toLocaleDateString("pt-BR")}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {products.length === 0 && eanGroups.length === 0 && categoryGroups.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              Nenhum produto encontrado
            </div>
          )}
        </>
      )}
    </div>
  );
}
