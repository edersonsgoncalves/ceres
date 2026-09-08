"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProductData {
  name: string;
  category: string | null;
  barcode: string | null;
}

interface Purchase {
  id: string;
  name: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  date: string;
  store: { name: string };
}

interface Stats {
  maxPrice: number;
  minPrice: number;
  avgPrice: number;
  totalPurchases: number;
  totalSpent: number;
}

interface ProductResponse {
  product: ProductData;
  purchases: Purchase[];
  stats: Stats;
}

export default function ProdutoRevisaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<ProductResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editName, setEditName] = useState("");
  const [editBarcode, setEditBarcode] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [userRole, setUserRole] = useState("user");

  useEffect(() => {
    const productName = decodeURIComponent(id);
    Promise.all([
      fetch(`/api/products/${encodeURIComponent(productName)}`).then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()).catch(() => ({ role: "user" })),
    ])
      .then(([productData, userData]) => {
        if (productData.product) {
          setData(productData);
          setEditName(productData.product.name);
          setEditBarcode(productData.product.barcode || "");
          setEditCategory(productData.product.category || "");
        }
        if (userData.role) setUserRole(userData.role);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(data?.product.name || "")}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName: editName, barcode: editBarcode || null, category: editCategory || null }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      setData((prev) => prev ? { ...prev, product: { ...prev.product, name: editName, barcode: editBarcode || null, category: editCategory || null } } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center text-gray-500 dark:text-gray-400 p-8">Carregando...</div>;
  if (error && !data) return <div className="text-center text-red-500 p-8">{error}</div>;
  if (!data) return <div className="text-center text-gray-500 dark:text-gray-400 p-8">Produto nao encontrado</div>;

  const canEditName = userRole === "admin";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Detalhes do Produto</h1>
          <p className="text-gray-500 dark:text-gray-400">{data.product.name}</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>Voltar</Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dados do Produto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nome</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={!canEditName}
                className="mt-1"
              />
              {!canEditName && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Apenas administradores podem editar o nome</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Codigo de Barras</label>
              <Input
                value={editBarcode}
                onChange={(e) => setEditBarcode(e.target.value)}
                placeholder="Ex: 7891234567890"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Categoria</label>
              <Input
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                placeholder="Ex: Bebidas"
                className="mt-1"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar Alteracoes"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estatisticas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Preco Maximo</p>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">R$ {data.stats.maxPrice.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Preco Minimo</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">R$ {data.stats.minPrice.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Preco Medio</p>
                <p className="text-lg font-bold">R$ {data.stats.avgPrice.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Total Gasto</p>
                <p className="text-lg font-bold">R$ {data.stats.totalSpent.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Total de Compras</p>
                <p className="text-lg font-bold">{data.stats.totalPurchases}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Economia Possivel</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  R$ {(data.stats.maxPrice - data.stats.minPrice).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historico de Compras ({data.purchases.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Data</th>
                  <th className="text-left p-2">Estabelecimento</th>
                  <th className="text-left p-2">Nome Original</th>
                  <th className="text-right p-2">Qtd</th>
                  <th className="text-right p-2">Preco Unit.</th>
                  <th className="text-right p-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.purchases.map((purchase) => (
                  <tr key={purchase.id} className="border-b hover:bg-gray-50 dark:hover:bg-neutral-800">
                    <td className="p-2">{new Date(purchase.date).toLocaleDateString("pt-BR")}</td>
                    <td className="p-2">{purchase.store.name}</td>
                    <td className="p-2 text-gray-500 dark:text-gray-400 text-xs">{purchase.name}</td>
                    <td className="p-2 text-right">{purchase.quantity} {purchase.unit}</td>
                    <td className="p-2 text-right">R$ {purchase.unitPrice.toFixed(2)}</td>
                    <td className="p-2 text-right font-medium">R$ {purchase.totalPrice.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
