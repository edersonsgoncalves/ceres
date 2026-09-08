"use client";

import { useState } from "react";

interface CategoryExpense {
  category: string;
  total: number;
  count: number;
  items?: { name: string; unitPrice: number; quantity: number; invoiceDate: string; store: string }[];
}

interface ExpenseChartProps {
  data: CategoryExpense[];
  onCategoryClick?: (category: string) => void;
}

export function ExpenseChart({ data, onCategoryClick }: ExpenseChartProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500 dark:text-gray-400">
        Nenhum dado disponivel
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.total, 0);
  const maxValue = Math.max(...data.map((item) => item.total));

  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-yellow-500",
    "bg-red-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-orange-500",
  ];

  const toggleCategory = (category: string) => {
    setExpanded(expanded === category ? null : category);
    onCategoryClick?.(category);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2" style={{ height: "200px" }}>
        {data.map((item, index) => {
          const percentage = total > 0 ? (item.total / total) * 100 : 0;
          const barHeight = maxValue > 0 ? (item.total / maxValue) * 100 : 0;

          return (
            <button
              key={item.category}
              onClick={() => toggleCategory(item.category)}
              className="flex flex-1 flex-col items-center gap-1 cursor-pointer hover:opacity-80"
            >
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {percentage.toFixed(1)}%
              </div>
              <div
                className={`w-full rounded-t transition-all ${colors[index % colors.length]} ${expanded === item.category ? "ring-2 ring-offset-1 ring-blue-400" : ""}`}
                style={{ height: `${Math.max(barHeight, 5)}%` }}
              />
              <div className="text-center text-xs">
                <p className="font-medium truncate">{item.category}</p>
                <p className="text-gray-500 dark:text-gray-400">R$ {item.total.toFixed(2)}</p>
              </div>
            </button>
          );
        })}
      </div>

      {expanded && data.find((d) => d.category === expanded)?.items && (
        <div className="border rounded-lg p-3 bg-gray-50 dark:bg-neutral-950 max-h-48 overflow-y-auto">
          <p className="text-sm font-semibold mb-2">{expanded}</p>
          {data.find((d) => d.category === expanded)!.items!.map((item, i) => (
            <div key={i} className="flex justify-between text-sm py-1 border-b last:border-0">
              <span>{item.name} ({item.quantity}x)</span>
              <span className="text-gray-500 dark:text-gray-400">R$ {item.unitPrice.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
