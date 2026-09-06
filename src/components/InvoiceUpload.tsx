"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImagePreview } from "@/components/ImagePreview";
import { QRCodeScanner } from "@/components/QRCodeScanner";

const EXAMPLE_JSON = `{
  "store": {
    "name": "Supermercado Exemplo",
    "cnpj": "12345678000190"
  },
  "issueDate": "2026-08-26",
  "totalAmount": 45.90,
  "paymentMethod": "Dinheiro",
  "items": [
    {
      "productName": "Arroz Tipo 1 5kg",
      "barcode": "7891234567890",
      "category": "Mercearia",
      "quantity": 1,
      "unit": "un",
      "unitPrice": 25.90
    },
    {
      "productName": "Feijao Carioca 1kg",
      "barcode": "7891234567891",
      "quantity": 2,
      "unit": "un",
      "unitPrice": 10.00
    }
  ]
}`;

type Mode = "choose" | "upload" | "qrcode" | "accessKey" | "import";

export function InvoiceUpload() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [mode, setMode] = useState<Mode>("choose");

  const [accessKey, setAccessKey] = useState("");
  const [importJson, setImportJson] = useState("");
  const [importPreview, setImportPreview] = useState<{
    store: string;
    date: string;
    total: number;
    itemsCount: number;
  } | null>(null);

  const handleFileChange = useCallback((selectedFile: File) => {
    if (!selectedFile.type.startsWith("image/")) {
      setError("Por favor, selecione uma imagem");
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("A imagem deve ter no maximo 10MB");
      return;
    }
    setFile(selectedFile);
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => setPreviewUrl(e.target?.result as string);
    reader.readAsDataURL(selectedFile);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileChange(droppedFile);
  }, [handleFileChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setError("Selecione uma imagem da nota fiscal"); return; }
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("image", file);
      if (storeName) formData.append("storeName", storeName);
      const response = await fetch("/api/invoices", { method: "POST", body: formData });
      const data = await response.json();
      if (response.status === 409 && data.existingId) {
        router.push(`/notas-fiscais/${data.existingId}/revisao`);
        return;
      }
      if (!response.ok) throw new Error(data.error || "Erro ao processar nota fiscal");
      router.push(`/notas-fiscais/${data.invoice.id}/revisao`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar nota fiscal");
    } finally {
      setLoading(false);
    }
  };

  const handleQrUrlDetected = async (url: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/invoices/from-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (response.status === 409 && data.existingId) {
        router.push(`/notas-fiscais/${data.existingId}/revisao`);
        return;
      }
      if (!response.ok) throw new Error(data.error || "Erro ao processar QR Code");
      router.push(`/notas-fiscais/${data.invoice.id}/revisao`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar QR Code");
      setLoading(false);
    }
  };

  const handleAccessKeySubmit = async () => {
    const digits = accessKey.replace(/\D/g, "");
    if (digits.length !== 44) {
      setError("A chave de acesso deve ter exatamente 44 digitos");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/invoices/from-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: digits }),
      });
      const data = await response.json();
      if (response.status === 409 && data.existingId) {
        router.push(`/notas-fiscais/${data.existingId}/revisao`);
        return;
      }
      if (!response.ok) throw new Error(data.error || "Erro ao cadastrar nota fiscal");
      router.push(`/notas-fiscais/${data.invoice.id}/revisao`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar nota fiscal");
      setLoading(false);
    }
  };

  const handleImportJsonChange = (value: string) => {
    setImportJson(value);
    setImportPreview(null);
    setError("");
    try {
      const parsed = JSON.parse(value);
      const totalItems = parsed.items?.reduce(
        (sum: number, item: { totalPrice?: number; quantity: number; unitPrice: number }) =>
          sum + (item.totalPrice ?? item.quantity * item.unitPrice),
        0
      ) ?? 0;
      setImportPreview({
        store: parsed.store?.name || "Loja nao informada",
        date: parsed.issueDate || "",
        total: parsed.totalAmount ?? totalItems,
        itemsCount: parsed.items?.length ?? 0,
      });
    } catch {
      // JSON invalido, sem preview
    }
  };

  const handleImportSubmit = async () => {
    let parsed;
    try {
      parsed = JSON.parse(importJson);
    } catch {
      setError("JSON invalido. Verifique a formatacao.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/invoices/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await response.json();
      if (response.status === 409 && data.existingId) {
        router.push(`/notas-fiscais/${data.existingId}/revisao`);
        return;
      }
      if (!response.ok) {
        const details = data.details ? `\n${data.details.join("\n")}` : "";
        throw new Error((data.error || "Erro ao importar nota fiscal") + details);
      }
      router.push(`/notas-fiscais/${data.invoice.id}/revisao`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao importar nota fiscal");
      setLoading(false);
    }
  };

  const resetState = () => {
    setMode("choose");
    setError("");
    setFile(null);
    setPreviewUrl(null);
    setAccessKey("");
    setImportJson("");
    setImportPreview(null);
  };

  if (mode === "choose") {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Nova Nota Fiscal</CardTitle>
          <CardDescription>Como deseja importar a nota fiscal?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={() => setMode("qrcode")} className="w-full h-14 text-base" variant="default">
            <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            Ler QR Code
          </Button>
          <Button onClick={() => setMode("accessKey")} className="w-full h-14 text-base" variant="outline">
            <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Chave de Acesso
          </Button>
          <Button onClick={() => setMode("upload")} className="w-full h-14 text-base" variant="outline">
            <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Enviar Foto
          </Button>
          <Button onClick={() => setMode("import")} className="w-full h-14 text-base" variant="outline">
            <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Importar JSON
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (mode === "qrcode") {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Ler QR Code</CardTitle>
          <CardDescription>Aponte a camera para o QR Code da nota fiscal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <p className="text-blue-600 text-sm">Buscando dados da nota fiscal...</p>}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {!loading && <QRCodeScanner onUrlDetected={handleQrUrlDetected} onError={setError} />}
          <Button variant="ghost" onClick={resetState}>Voltar</Button>
        </CardContent>
      </Card>
    );
  }

  if (mode === "accessKey") {
    const digitCount = accessKey.replace(/\D/g, "").length;
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Chave de Acesso</CardTitle>
          <CardDescription>Digite ou cole a chave de acesso de 44 digitos da NFC-e</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Input
              value={accessKey}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "").slice(0, 44);
                const formatted = raw.replace(/(\d{4})(?=\d)/g, "$1 ");
                setAccessKey(formatted);
                setError("");
              }}
              placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
              className="font-mono text-lg tracking-wider"
              inputMode="numeric"
              disabled={loading}
            />
            <p className="mt-1 text-sm text-gray-500">
              {digitCount}/44 digitos
            </p>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {loading && <p className="text-blue-600 text-sm">Buscando dados da nota fiscal...</p>}
          <div className="flex gap-2">
            <Button
              onClick={handleAccessKeySubmit}
              disabled={loading || digitCount !== 44}
              className="flex-1"
            >
              {loading ? "Buscando..." : "Cadastrar Nota"}
            </Button>
            <Button variant="ghost" onClick={resetState} disabled={loading}>
              Voltar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (mode === "import") {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Importar JSON</CardTitle>
          <CardDescription>Cole o JSON da nota fiscal para importar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            value={importJson}
            onChange={(e) => handleImportJsonChange(e.target.value)}
            placeholder={EXAMPLE_JSON}
            className="w-full h-64 p-3 font-mono text-sm border rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          {importPreview && (
            <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
              <p><strong>Loja:</strong> {importPreview.store}</p>
              <p><strong>Data:</strong> {importPreview.date}</p>
              <p><strong>Total:</strong> R$ {importPreview.total.toFixed(2)}</p>
              <p><strong>Itens:</strong> {importPreview.itemsCount}</p>
            </div>
          )}
          {error && <p className="text-red-500 text-sm whitespace-pre-line">{error}</p>}
          <div className="flex gap-2">
            <Button
              onClick={handleImportSubmit}
              disabled={loading || !importJson.trim()}
              className="flex-1"
            >
              {loading ? "Importando..." : "Importar Nota"}
            </Button>
            <Button variant="ghost" onClick={() => { setImportJson(EXAMPLE_JSON); handleImportJsonChange(EXAMPLE_JSON); }}>
              Exemplo
            </Button>
            <Button variant="ghost" onClick={resetState} disabled={loading}>
              Voltar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Nova Nota Fiscal</CardTitle>
        <CardDescription>Envie uma foto da nota fiscal para extrair os itens automaticamente</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-sm font-medium text-gray-700">Nome do estabelecimento (opcional)</label>
            <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Ex: Supermercado XYZ" className="mt-1" />
          </div>
          <div
            className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChange(f); }} />
            <div className="space-y-4">
              <div className="text-gray-500">
                <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-gray-700">Arraste e solte a imagem aqui, ou{" "}<button type="button" onClick={() => fileInputRef.current?.click()} className="text-blue-600 hover:underline">clique para selecionar</button></p>
                <p className="mt-1 text-sm text-gray-500">PNG, JPG ou WEBP (max. 10MB)</p>
              </div>
            </div>
          </div>
          <ImagePreview file={file} previewUrl={previewUrl} />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading || !file}>{loading ? "Processando..." : "Processar Nota Fiscal"}</Button>
          <Button type="button" variant="ghost" className="w-full" onClick={resetState}>Voltar</Button>
        </form>
      </CardContent>
    </Card>
  );
}
