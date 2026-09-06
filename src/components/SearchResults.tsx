"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PriceHistory {
  id: string;
  price: number;
  date: string;
  store: {
    name: string;
  };
}

interface ProductWithPrices {
  id: string;
  name: string;
  eanCode: string | null;
  category: {
    name: string;
  } | null;
  priceHistory: PriceHistory[];
}

interface SearchResultsProps {
  products: ProductWithPrices[];
}

export function SearchResults({ products }: SearchResultsProps) {
  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          Nenhum produto encontrado
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {products.map((product) => {
        const latestPrice =
          product.priceHistory.length > 0
            ? product.priceHistory.sort(
                (a, b) =>
                  new Date(b.date).getTime() - new Date(a.date).getTime()
              )[0]
            : null;

        return (
          <Link key={product.id} href={`/produtos/${product.id}`}>
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                  {product.category && (
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                      {product.category.name}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    {product.eanCode && (
                      <p className="text-sm text-gray-500">
                        EAN: {product.eanCode}
                      </p>
                    )}
                    {latestPrice && (
                      <p className="text-sm text-gray-500">
                        Último preço: R${" "}
                        {latestPrice.price.toFixed(2)} em{" "}
                        {latestPrice.store.name}
                      </p>
                    )}
                  </div>
                  {latestPrice && (
                    <p className="text-xl font-bold text-green-600">
                      R$ {latestPrice.price.toFixed(2)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
