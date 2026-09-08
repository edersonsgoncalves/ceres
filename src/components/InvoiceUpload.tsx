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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
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

  const MAX_FILES = 3;

  const handleFilesSelected = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    const newFiles: File[] = [];
    for (let i = 0; i < selectedFiles.length && files.length + newFiles.length < MAX_FILES; i++) {
      const f = selectedFiles[i];
      if (!f.type.startsWith("image/")) continue;
      if (f.size > 10 * 1024 * 1024) {
        setError(`${f.name}: imagem deve ter no maximo 10MB`);
        continue;
      }
      newFiles.push(f);
    }
    if (newFiles.length === 0) return;

    setError("");
    const updatedFiles = [...files, ...newFiles].slice(0, MAX_FILES);
    setFiles(updatedFiles);

    const newUrls = newFiles.map((f) => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(f);
      });
    });

    Promise.all(newUrls).then((urls) => {
      setPreviewUrls((prev) => [...prev, ...urls].slice(0, MAX_FILES));
    });
  }, [files]);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    handleFilesSelected(e.dataTransfer.files);
  }, [handleFilesSelected]);

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
    if (files.length === 0) { setError("Selecione pelo menos uma imagem"); return; }
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      for (const f of files) {
        formData.append("images", f);
      }
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
    setFiles([]);
    setPreviewUrls([]);
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Tirar Foto / Enviar
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
          {loading && <p className="text-blue-600 dark:text-blue-400 text-sm">Buscando dados da nota fiscal...</p>}
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
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {digitCount}/44 digitos
            </p>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {loading && <p className="text-blue-600 dark:text-blue-400 text-sm">Buscando dados da nota fiscal...</p>}
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
            <div className="p-3 bg-gray-50 dark:bg-neutral-950 rounded-lg text-sm space-y-1">
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
        <CardDescription>Tire fotos da nota fiscal para extrair os itens automaticamente (max. {MAX_FILES} imagens)</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nome do estabelecimento (opcional)</label>
            <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Ex: Supermercado XYZ" className="mt-1" />
          </div>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            multiple
            onChange={(e) => { handleFilesSelected(e.target.files); if (cameraInputRef.current) cameraInputRef.current.value = ""; }}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            multiple
            onChange={(e) => { handleFilesSelected(e.target.files); if (galleryInputRef.current) galleryInputRef.current.value = ""; }}
          />

          <div className="flex gap-2">
            <Button
              type="button"
              variant="default"
              className="flex-1 h-12"
              onClick={() => cameraInputRef.current?.click()}
              disabled={files.length >= MAX_FILES}
            >
              <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Tirar Foto
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12"
              onClick={() => galleryInputRef.current?.click()}
              disabled={files.length >= MAX_FILES}
            >
              <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Galeria
            </Button>
          </div>

          {files.length > 0 && files.length < MAX_FILES && (
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              + {MAX_FILES - files.length} {MAX_FILES - files.length === 1 ? "foto restante" : "fotos restantes"} (para melhor detalhamento)
            </p>
          )}

          {files.length > 0 && (
            <div
              className={`rounded-lg border-2 border-dashed p-4 text-center transition-colors ${dragActive ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-gray-300 dark:border-neutral-600"}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <p className="text-sm text-gray-500 dark:text-gray-400">Arraste mais imagens aqui ou clique nos botoes acima</p>
            </div>
          )}

          <ImagePreview files={files} previewUrls={previewUrls} onRemove={handleRemoveFile} />

          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading || files.length === 0}>
            {loading ? "Processando..." : `Processar ${files.length > 0 ? `${files.length} ${files.length === 1 ? "imagem" : "imagens"}` : "Nota Fiscal"}`}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={resetState}>Voltar</Button>
        </form>
      </CardContent>
    </Card>
  );
}
