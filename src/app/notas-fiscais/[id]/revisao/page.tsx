"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { InvoiceReview } from "@/components/InvoiceReview";
import { InvoiceItem } from "@/types/invoice";

interface Invoice {
  id: string;
  storeName: string;
  date: string | null;
  total: number;
  items: InvoiceItem[];
  source?: string;
}

export default function RevisaoPage() {
  const params = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const response = await fetch(`/api/invoices/${params.id}`);
        if (!response.ok) throw new Error("Nota fiscal nao encontrada");
        const data = await response.json();
        setInvoice(data.invoice);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar nota fiscal");
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [params.id]);

  if (loading) return <div className="text-center text-gray-500 dark:text-gray-400">Carregando...</div>;
  if (error) return <div className="text-center text-red-500">{error}</div>;
  if (!invoice) return <div className="text-center text-gray-500 dark:text-gray-400">Nota fiscal nao encontrada</div>;

  return (
    <InvoiceReview
      invoiceId={invoice.id}
      storeName={invoice.storeName}
      date={invoice.date || undefined}
      total={invoice.total}
      items={invoice.items}
      source={invoice.source}
    />
  );
}
