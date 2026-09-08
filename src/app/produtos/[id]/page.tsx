"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { PriceComparison } from "@/components/PriceComparison";

interface PriceEntry {
  id: string;
  price: number;
  date: string;
  store: {
    name: string;
    city: string | null;
    state: string | null;
  };
}

interface Product {
  id: string;
  name: string;
  eanCode: string | null;
  category: {
    name: string;
  } | null;
  prices: PriceEntry[];
}

export default function ProdutoPage() {
  const params = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await fetch(`/api/products/${params.id}`);
        if (!response.ok) {
          throw new Error("Produto não encontrado");
        }
        const data = await response.json();
        setProduct(data.product);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar produto");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [params.id]);

  if (loading) {
    return <div className="text-center text-gray-500 dark:text-gray-400">Carregando...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500">{error}</div>;
  }

  if (!product) {
    return <div className="text-center text-gray-500 dark:text-gray-400">Produto não encontrado</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{product.name}</h1>
        <div className="mt-2 flex gap-2">
          {product.eanCode && (
            <span className="rounded-full bg-gray-100 dark:bg-neutral-800 px-3 py-1 text-sm text-gray-600 dark:text-gray-400">
              EAN: {product.eanCode}
            </span>
          )}
          {product.category && (
            <span className="rounded-full bg-blue-100 dark:bg-blue-900 px-3 py-1 text-sm text-blue-600 dark:text-blue-400">
              {product.category.name}
            </span>
          )}
        </div>
      </div>

      <PriceComparison productName={product.name} prices={product.prices} />
    </div>
  );
}
