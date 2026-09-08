"use client";

import { useState } from "react";
import Link from "next/link";

interface StoreTicketData {
  store: string;
  storeId?: string;
  total: number;
  count: number;
  average: number;
  invoices?: { id: string; total: number; date: string; itemsCount: number }[];
}

interface StoreTicketProps {
  data: StoreTicketData[];
}

export function StoreTicket({ data }: StoreTicketProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-gray-500 dark:text-gray-400">
        Nenhum dado disponivel
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.store}>
          <button
            onClick={() => setExpanded(expanded === item.store ? null : item.store)}
            className="w-full flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors text-left"
          >
            <div>
              <p className="font-medium">{item.store}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {item.count} compras
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">R$ {item.average.toFixed(2)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">ticket medio</p>
            </div>
          </button>

          {expanded === item.store && item.invoices && (
            <div className="mt-2 border rounded-lg p-3 bg-gray-50 dark:bg-neutral-950">
              <p className="text-sm font-semibold mb-2">Notas fiscais</p>
              {item.invoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/notas-fiscais/${inv.id}/revisao`}
                  className="flex justify-between text-sm py-1 border-b last:border-0 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <span>{new Date(inv.date).toLocaleDateString("pt-BR")} - {inv.itemsCount} itens</span>
                  <span className="text-gray-500 dark:text-gray-400">R$ {inv.total.toFixed(2)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
