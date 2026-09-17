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

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [targetProduct, setTargetProduct] = useState("");
  const [allProductNames, setAllProductNames] = useState<string[]>([]);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState("");

  useEffect(() => {
    const productName = decodeURIComponent(id);
    Promise.all([
      fetch(`/api/products/${encodeURIComponent(productName)}`).then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()).catch(() => ({ role: "user" })),
      fetch("/api/products?recent=true").then((r) => r.json()),
    ])
      .then(([productData, userData, productsData]) => {
        if (productData.product) {
          setData(productData);
          setEditName(productData.product.name);
          setEditBarcode(productData.product.barcode || "");
          setEditCategory(productData.product.category || "");
        }
        if (userData.role) setUserRole(userData.role);
        if (productsData.products) {
          setAllProductNames(productsData.products.map((p: { productName: string }) => p.productName));
        }
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

  const toggleSelect = (purchaseId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(purchaseId)) next.delete(purchaseId);
      else next.add(purchaseId);
      return next;
    });
  };

  const toggleAll = () => {
    if (!data) return;
    if (selectedIds.size === data.purchases.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.purchases.map((p) => p.id)));
    }
  };

  const handleMove = async () => {
    if (!targetProduct.trim() || !data) return;
    setMoving(true);
    setMoveError("");
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(data.product.name)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemIds: Array.from(selectedIds),
          targetProductName: targetProduct.trim(),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro ao mover itens");

      setData((prev) => {
        if (!prev) return prev;
        const movedIds = new Set(selectedIds);
        return {
          ...prev,
          purchases: prev.purchases.filter((p) => !movedIds.has(p.id)),
          stats: {
            ...prev.stats,
            totalPurchases: prev.stats.totalPurchases - result.moved,
          },
        };
      });
      setSelectedIds(new Set());
      setShowMoveDialog(false);
      setTargetProduct("");
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : "Erro ao mover itens");
    } finally {
      setMoving(false);
    }
  };

  const filteredSuggestions = targetProduct.length > 0
    ? allProductNames.filter((n) =>
        n.toLowerCase().includes(targetProduct.toLowerCase()) && n !== data?.product.name
      ).slice(0, 8)
    : [];

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
          <div className="flex items-center justify-between">
            <CardTitle>Historico de Compras ({data.purchases.length})</CardTitle>
            {selectedIds.size > 0 && (
              <Button
                size="sm"
                onClick={() => { setShowMoveDialog(true); setTargetProduct(""); setMoveError(""); }}
              >
                Mover {selectedIds.size} {selectedIds.size === 1 ? "item" : "itens"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {showMoveDialog && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
              <p className="text-sm font-medium mb-2">Mover {selectedIds.size} {selectedIds.size === 1 ? "item" : "itens"} para:</p>
              <div className="relative">
                <Input
                  value={targetProduct}
                  onChange={(e) => setTargetProduct(e.target.value)}
                  placeholder="Digite o nome do produto destino..."
                  className="pr-24"
                />
                {filteredSuggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg dark:bg-neutral-900 dark:border-neutral-700">
                    {filteredSuggestions.map((name) => (
                      <button
                        key={name}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-neutral-800"
                        onClick={() => { setTargetProduct(name); }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {moveError && <p className="text-sm text-red-500 mt-2">{moveError}</p>}
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={handleMove} disabled={moving || !targetProduct.trim()}>
                  {moving ? "Movendo..." : "Confirmar"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowMoveDialog(false)}>Cancelar</Button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 w-8">
                    <input
                      type="checkbox"
                      checked={data.purchases.length > 0 && selectedIds.size === data.purchases.length}
                      onChange={toggleAll}
                      className="rounded"
                    />
                  </th>
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
                  <tr
                    key={purchase.id}
                    className={`border-b hover:bg-gray-50 dark:hover:bg-neutral-800 ${
                      selectedIds.has(purchase.id) ? "bg-blue-50 dark:bg-blue-950" : ""
                    }`}
                  >
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(purchase.id)}
                        onChange={() => toggleSelect(purchase.id)}
                        className="rounded"
                      />
                    </td>
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
