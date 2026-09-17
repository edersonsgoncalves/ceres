"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface StoreData {
  id: string;
  name: string;
  cnpj: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
}

interface StoreFormProps {
  initialData?: StoreData;
  onStoreCreated?: () => void;
  onSave?: (store: StoreData) => void;
  onCancel?: () => void;
}

export function StoreForm({ initialData, onStoreCreated, onSave, onCancel }: StoreFormProps) {
  const isEdit = !!initialData;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState(initialData?.name || "");
  const [cnpj, setCnpj] = useState(initialData?.cnpj || "");
  const [address, setAddress] = useState(initialData?.address || "");
  const [city, setCity] = useState(initialData?.city || "");
  const [state, setState] = useState(initialData?.state || "");

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setCnpj(initialData.cnpj || "");
      setAddress(initialData.address || "");
      setCity(initialData.city || "");
      setState(initialData.state || "");
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const url = isEdit ? `/api/estabelecimentos/${initialData!.id}` : "/api/estabelecimentos";
      const method = isEdit ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, cnpj, address, city, state }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao salvar estabelecimento");
      }

      const data = await response.json();
      if (isEdit) {
        onSave?.(data.store);
      } else {
        setName("");
        setCnpj("");
        setAddress("");
        setCity("");
        setState("");
        onStoreCreated?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar estabelecimento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{isEdit ? "Editar Estabelecimento" : "Novo Estabelecimento"}</CardTitle>
        <CardDescription>
          {isEdit ? "Atualize os dados da loja" : "Cadastre um supermercado ou loja"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nome</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Supermercado XYZ"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">CNPJ</label>
            <Input
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0001-00"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Endereco</label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, numero, bairro"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cidade</label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Sao Paulo"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Estado</label>
              <Input
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="SP"
                maxLength={2}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Salvando..." : isEdit ? "Salvar Alteracoes" : "Criar Estabelecimento"}
            </Button>
            {isEdit && onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
