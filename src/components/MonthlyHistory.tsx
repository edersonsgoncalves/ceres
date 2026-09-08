"use client";

import { useState } from "react";

interface MonthlyData {
  month: string;
  total: number;
  count: number;
  invoices?: { id: string; storeName: string; total: number; date: string }[];
}

interface MonthlyHistoryProps {
  data: MonthlyData[];
}

export function MonthlyHistory({ data }: MonthlyHistoryProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500 dark:text-gray-400">
        Nenhum dado disponivel
      </div>
    );
  }

  const maxValue = Math.max(...data.map((item) => item.total));

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2" style={{ height: "200px" }}>
        {data.map((item) => {
          const barHeight = maxValue > 0 ? (item.total / maxValue) * 100 : 0;

          return (
            <button
              key={item.month}
              onClick={() => setExpanded(expanded === item.month ? null : item.month)}
              className="flex flex-1 flex-col items-center gap-1 cursor-pointer hover:opacity-80"
            >
              <div className="text-xs text-gray-500 dark:text-gray-400">
                R$ {item.total.toFixed(0)}
              </div>
              <div
                className={`w-full rounded-t bg-blue-500 transition-all ${expanded === item.month ? "ring-2 ring-offset-1 ring-blue-400" : ""}`}
                style={{ height: `${Math.max(barHeight, 5)}%` }}
              />
              <div className="text-center text-xs">
                <p className="font-medium">{item.month}</p>
                <p className="text-gray-500 dark:text-gray-400">{item.count} compras</p>
              </div>
            </button>
          );
        })}
      </div>

      {expanded && data.find((d) => d.month === expanded)?.invoices && (
        <div className="border rounded-lg p-3 bg-gray-50 dark:bg-neutral-950 max-h-48 overflow-y-auto">
          <p className="text-sm font-semibold mb-2">{expanded}</p>
          {data.find((d) => d.month === expanded)!.invoices!.map((inv) => (
            <div key={inv.id} className="flex justify-between text-sm py-1 border-b last:border-0">
              <span>{inv.storeName}</span>
              <span className="text-gray-500 dark:text-gray-400">R$ {inv.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
