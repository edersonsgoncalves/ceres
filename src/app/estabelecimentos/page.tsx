"use client";

import { useState, useEffect } from "react";
import { StoreForm } from "@/components/StoreForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Store {
  id: string;
  name: string;
  cnpj: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
}

export default function EstabelecimentosPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStores = async () => {
    try {
      const response = await fetch("/api/estabelecimentos");
      if (response.ok) {
        const data = await response.json();
        setStores(data.stores || []);
      }
    } catch (error) {
      console.error("Erro ao buscar estabelecimentos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Estabelecimentos</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Gerencie os supermercados e lojas cadastrados
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <StoreForm onStoreCreated={fetchStores} />

        <Card>
          <CardHeader>
            <CardTitle>Estabelecimentos Cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500 dark:text-gray-400">Carregando...</p>
            ) : stores.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">Nenhum estabelecimento cadastrado.</p>
            ) : (
              <div className="space-y-3">
                {stores.map((store) => (
                  <div
                    key={store.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{store.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {store.city && store.state
                          ? `${store.city}, ${store.state}`
                          : store.address || "Endereço não informado"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
