"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Invoice {
  id: string;
  storeName: string;
  invoiceNumber: string;
  date: string;
  total: number;
  totalItemsCount: number;
  createdAt: string;
}

export default function NotasFiscaisPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchInvoices = () => {
    fetch("/api/invoices")
      .then((res) => {
        if (!res.ok) throw new Error("Erro ao carregar notas fiscais");
        return res.json();
      })
      .then((data) => setInvoices(data.invoices || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchInvoices(); }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm("Tem certeza que deseja excluir esta nota fiscal?")) return;

    try {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir");
      setInvoices(invoices.filter((inv) => inv.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir");
    }
  };

  if (loading) return <div className="text-center text-gray-500 p-8">Carregando...</div>;
  if (error) return <div className="text-center text-red-500 p-8">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Notas Fiscais</h1>
          <p className="text-gray-500">{invoices.length} notas cadastradas</p>
        </div>
        <Link href="/notas-fiscais/nova">
          <Button>Nova NF</Button>
        </Link>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            Nenhuma nota fiscal cadastrada.{" "}
            <Link href="/notas-fiscais/nova" className="text-blue-500 underline">
              Cadastrar primeira nota
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {invoices.map((inv) => (
            <Link key={inv.id} href={`/notas-fiscais/${inv.id}/revisao`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{inv.storeName}</p>
                    <p className="text-sm text-gray-500">
                      {inv.invoiceNumber} · {inv.totalItemsCount} itens
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-lg">R$ {inv.total.toFixed(2)}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(inv.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={(e) => handleDelete(inv.id, e)}
                    >
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
