"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Product {
  id: string;
  name: string;
  eanCode: string | null;
  category: {
    name: string;
  } | null;
}

interface ProductSearchProps {
  onSelect?: (product: Product) => void;
}

export function ProductSearch({ onSelect }: ProductSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/products?search=${encodeURIComponent(query)}`
      );
      if (response.ok) {
        const data = await response.json();
        setResults(data.products || []);
        setShowResults(true);
      }
    } catch (error) {
      console.error("Erro na busca:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleSelect = (product: Product) => {
    onSelect?.(product);
    setQuery(product.name);
    setShowResults(false);
  };

  return (
    <div ref={searchRef} className="relative w-full">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar produto por nome ou código de barras..."
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? "Buscando..." : "Buscar"}
        </Button>
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white dark:bg-neutral-900 shadow-lg">
          <div className="max-h-64 overflow-y-auto">
            {results.map((product) => (
              <button
                key={product.id}
                className="flex w-full items-center justify-between border-b p-3 text-left hover:bg-gray-50 dark:hover:bg-neutral-800 last:border-b-0"
                onClick={() => handleSelect(product)}
              >
                <div>
                  <p className="font-medium">{product.name}</p>
                  {product.eanCode && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      EAN: {product.eanCode}
                    </p>
                  )}
                </div>
                {product.category && (
                  <span className="rounded-full bg-gray-100 dark:bg-neutral-800 px-2 py-1 text-xs text-gray-600 dark:text-gray-400">
                    {product.category.name}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {showResults && results.length === 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white dark:bg-neutral-900 p-4 text-center shadow-lg">
          <p className="text-gray-500 dark:text-gray-400">Nenhum produto encontrado</p>
        </div>
      )}
    </div>
  );
}
