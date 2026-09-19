"use client";

import { useState } from "react";
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

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({ search: query.trim() });
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      setProducts(data.products || []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4 pt-12">
        <h1 className="text-4xl font-bold">Ceres</h1>
        <p className="text-lg text-gray-500 dark:text-gray-400">
          Compare precos de produtos entre estabelecimentos
        </p>
      </div>

      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Buscar por nome do produto ou codigo de barras..."
            className="flex-1 text-base"
          />
          <Button onClick={handleSearch} disabled={loading} size="lg">
            {loading ? "Buscando..." : "Buscar"}
          </Button>
        </div>
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

      {!loading && hasSearched && products.length === 0 && (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          Nenhum produto encontrado para &quot;{query}&quot;
        </div>
      )}

      {!loading && products.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">
            Resultados ({products.length} {products.length === 1 ? "produto" : "produtos"})
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <div
                key={product.productName}
                className="rounded-lg border p-4"
              >
                <p className="font-medium truncate">{product.productName}</p>
                {product.category && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">{product.category}</p>
                )}
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Menor preco:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      R$ {product.minPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Maior preco:</span>
                    <span className="font-medium text-red-600 dark:text-red-400">
                      R$ {product.maxPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                    <span>{product.purchaseCount} compras registradas</span>
                    {product.lastStore && <span>{product.lastStore}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
