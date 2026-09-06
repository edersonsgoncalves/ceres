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

export default function BuscaPage() {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [eanGroups, setEanGroups] = useState<EanGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [groupByEan, setGroupByEan] = useState(true);

  useEffect(() => {
    fetchProducts(undefined, true);
  }, []);

  const fetchProducts = async (search?: string, useGroupBy?: boolean) => {
    const shouldGroup = useGroupBy ?? groupByEan;
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (shouldGroup) params.set("groupBy", "ean");

    try {
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      if (shouldGroup) {
        setEanGroups(data.groups || []);
        setProducts([]);
      } else {
        setProducts(data.products || []);
        setEanGroups([]);
      }
    } catch {
      setProducts([]);
      setEanGroups([]);
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

  const handleGroupByEanToggle = async () => {
    const newValue = !groupByEan;
    setGroupByEan(newValue);
    if (hasSearched) {
      await fetchProducts(query, newValue);
    } else {
      await fetchProducts(undefined, newValue);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Buscar Produtos</h1>
        <p className="text-gray-500">Compare precos entre estabelecimentos</p>
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

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={groupByEan}
            onChange={handleGroupByEanToggle}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-600">Agrupar por EAN</span>
        </label>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-8">Carregando...</div>
      ) : (
        <>
          {groupByEan && eanGroups.length > 0 && (
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
                          <p className="text-xs text-gray-400 font-mono">EAN: {group.eanPrefix}*</p>
                        )}
                      </div>
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded whitespace-nowrap ml-2">
                        {group.products.length} {group.products.length === 1 ? "variante" : "variantes"}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {group.products.map((product) => (
                        <Link
                          key={product.productName}
                          href={`/produtos/${encodeURIComponent(product.productName)}/revisao`}
                          className="flex items-center justify-between rounded p-2 hover:bg-gray-50 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{product.productName}</p>
                            {product.category && (
                              <p className="text-xs text-gray-500 truncate">{product.category}</p>
                            )}
                          </div>
                          <div className="text-right text-sm ml-2">
                            <div className="flex gap-2">
                              <span className="text-green-600">R$ {product.minPrice.toFixed(2)}</span>
                              <span className="text-red-600">R$ {product.maxPrice.toFixed(2)}</span>
                            </div>
                            <p className="text-xs text-gray-400">{product.purchaseCount}x</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t flex justify-between text-xs text-gray-500">
                      <span>{group.stats.totalPurchases} compras</span>
                      <span>R$ {group.stats.totalSpent.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!groupByEan && products.length > 0 && (
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
                      <p className="text-xs text-gray-500">{product.category}</p>
                    )}
                    {product.barcode && (
                      <p className="text-xs text-gray-400 font-mono">EAN: {product.barcode}</p>
                    )}
                    <div className="mt-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Max:</span>
                        <span className="font-medium text-red-600">R$ {product.maxPrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Min:</span>
                        <span className="font-medium text-green-600">R$ {product.minPrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400">
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

          {products.length === 0 && eanGroups.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              Nenhum produto encontrado
            </div>
          )}
        </>
      )}
    </div>
  );
}
