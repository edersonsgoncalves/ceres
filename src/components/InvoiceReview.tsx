"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ItemEditor } from "@/components/ItemEditor";
import { InvoiceItem } from "@/types/invoice";

interface InvoiceReviewProps {
  invoiceId: string;
  storeName: string;
  date?: string;
  total: number;
  items: InvoiceItem[];
  source?: string;
}

export function InvoiceReview({
  invoiceId,
  storeName,
  date,
  total,
  items: initialItems,
  source,
}: InvoiceReviewProps) {
  const router = useRouter();
  const totalNumber = Number(total);
  const [items, setItems] = useState<InvoiceItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        if (data.categories) {
          setCategories(data.categories.map((c: { name: string }) => c.name));
        }
      })
      .catch(() => {});
  }, []);

  const updateItem = (index: number, updatedItem: InvoiceItem) => {
    const newItems = [...items];
    newItems[index] = updatedItem;
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculatedTotal = items.reduce((sum, item) => sum + Number(item.totalPrice), 0);

  const handleSave = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, totalAmount: calculatedTotal }),
      });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Erro ao salvar nota fiscal"); }
      router.push("/notas-fiscais");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja excluir esta nota fiscal?")) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Erro ao excluir nota fiscal");
      router.push("/notas-fiscais");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            Revisao da Nota Fiscal
            {source === "qr_code" && (
              <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:text-green-200">
                QR Code
              </span>
            )}
            {source === "ocr" && (
              <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:text-blue-200">
                OCR
              </span>
            )}
          </CardTitle>
          <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span>Estabelecimento: {storeName}</span>
            {date && <span>Data: {date}</span>}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-gray-50 dark:bg-neutral-950">
                  <th className="p-2 text-left text-sm font-medium">Cód. Barras</th>
                  <th className="p-2 text-left text-sm font-medium">Produto</th>
                  <th className="p-2 text-left text-sm font-medium">Qtd</th>
                  <th className="p-2 text-left text-sm font-medium">Un</th>
                  <th className="p-2 text-left text-sm font-medium">Preco Unit.</th>
                  <th className="p-2 text-left text-sm font-medium">Total</th>
                  <th className="p-2 text-left text-sm font-medium">Categoria</th>
                  <th className="p-2 text-left text-sm font-medium">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <ItemEditor key={index} item={item} index={index} onUpdate={updateItem} onRemove={removeItem} categories={categories} />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-gray-50 dark:bg-neutral-950 font-bold">
                  <td colSpan={5} className="p-2 text-right text-sm">Total:</td>
                  <td className="p-2 text-sm">R$ {calculatedTotal.toFixed(2)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
          {calculatedTotal !== totalNumber && (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
              Total original: R$ {totalNumber.toFixed(2)} | Total calculado: R$ {calculatedTotal.toFixed(2)}
            </p>
          )}
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          <div className="mt-6 flex gap-4">
            <Button onClick={handleSave} disabled={loading}>{loading ? "Salvando..." : "Salvar Nota Fiscal"}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>Excluir</Button>
            <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
