"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SavingsIndicator } from "./SavingsIndicator";

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

interface PriceComparisonProps {
  productName: string;
  prices: PriceEntry[];
}

export function PriceComparison({ productName, prices }: PriceComparisonProps) {
  if (prices.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          Nenhum preço registrado para este produto
        </CardContent>
      </Card>
    );
  }

  const sortedPrices = [...prices].sort((a, b) => a.price - b.price);
  const lowestPrice = sortedPrices[0].price;
  const highestPrice = sortedPrices[sortedPrices.length - 1].price;

  return (
    <div className="space-y-6">
      <SavingsIndicator lowestPrice={lowestPrice} highestPrice={highestPrice} />

      <Card>
        <CardHeader>
          <CardTitle>Preços por Estabelecimento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sortedPrices.map((entry, index) => {
              const isLowest = entry.price === lowestPrice;
              const isHighest = entry.price === highestPrice;

              return (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between rounded-lg p-3 ${
                    isLowest
                      ? "border-2 border-green-500 bg-green-50"
                      : isHighest
                      ? "border border-red-200 bg-red-50"
                      : "border border-gray-200"
                  }`}
                >
                  <div>
                    <p className="font-medium">{entry.store.name}</p>
                    <p className="text-sm text-gray-500">
                      {entry.store.city && entry.store.state
                        ? `${entry.store.city}, ${entry.store.state}`
                        : "Localização não informada"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(entry.date).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-xl font-bold ${
                        isLowest ? "text-green-600" : isHighest ? "text-red-600" : "text-gray-800"
                      }`}
                    >
                      R$ {entry.price.toFixed(2)}
                    </p>
                    {isLowest && (
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">
                        Menor preço
                      </span>
                    )}
                    {isHighest && (
                      <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-800">
                        Maior preço
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
