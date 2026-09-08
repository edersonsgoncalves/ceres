"use client";

interface ProductSummary {
  displayName: string;
  aliases: string[];
  maxPrice: number;
  minPrice: number;
  lastPurchase: string | Date | null;
  lastStore: string;
  totalQuantity: number;
  purchaseCount: number;
}

interface ProductSummaryListProps {
  products: ProductSummary[];
}

export function ProductSummaryList({ products }: ProductSummaryListProps) {
  if (products.length === 0) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
        Nenhum produto encontrado
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <div
          key={product.displayName}
          className="rounded-lg border p-4"
        >
          <p className="font-medium">{product.displayName}</p>
          {product.aliases.length > 1 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Tambem conhecido como: {product.aliases.filter((a) => a !== product.displayName).slice(0, 2).join(", ")}
            </p>
          )}
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Maximo:</span>
              <span className="font-medium text-red-600 dark:text-red-400">R$ {product.maxPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Minimo:</span>
              <span className="font-medium text-green-600 dark:text-green-400">R$ {product.minPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Economia:</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">
                R$ {(product.maxPrice - product.minPrice).toFixed(2)} ({product.maxPrice > 0 ? (((product.maxPrice - product.minPrice) / product.maxPrice) * 100).toFixed(0) : 0}%)
              </span>
            </div>
            {product.lastPurchase && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Ult. Compra:</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {new Date(product.lastPurchase).toLocaleDateString("pt-BR")} - {product.lastStore}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
