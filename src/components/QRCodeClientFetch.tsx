"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchSefazData } from "@/lib/sefaz-parser";

interface QRCodeClientFetchProps {
  onError?: (error: string) => void;
}

export function QRCodeClientFetch({ onError }: QRCodeClientFetchProps) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const startScanning = async () => {
    try {
      const scanner = new Html5Qrcode("qr-reader-client");
      scannerRef.current = scanner;
      setScanning(true);
      setStatus("Abrindo camera...");

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        (decodedText) => handleDetection(decodedText),
        () => {}
      );

      setStatus("Camera ativa — aponte para o QR Code");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao acessar camera";
      setStatus(`Erro: ${msg}`);
      onError?.(msg);
      setScanning(false);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const handleDetection = async (decodedText: string) => {
    await stopScanning();

    if (!decodedText.includes("fazenda.") && !decodedText.includes("sefaz.") && !decodedText.includes("consultaNFCe")) {
      setStatus("QR Code nao e uma URL de nota fiscal valida");
      onError?.("QR Code nao e uma URL de nota fiscal valida");
      return;
    }

    setLoading(true);
    setStatus("Buscando dados da nota fiscal na SEFAZ...");

    try {
      const invoiceData = await fetchSefazData(decodedText);

      if (invoiceData.items.length === 0) {
        throw new Error("Nenhum item encontrado na nota fiscal");
      }

      setStatus(`Encontrados ${invoiceData.items.length} itens. Cadastrando...`);

      const response = await fetch("/api/invoices/from-qr-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceData }),
      });

      const data = await response.json();

      if (response.status === 409 && data.existingId) {
        router.push(`/notas-fiscais/${data.existingId}/revisao`);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Erro ao cadastrar nota fiscal");
      }

      router.push(`/notas-fiscais/${data.invoice.id}/revisao`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao processar nota fiscal";
      setStatus(`Erro: ${msg}`);
      onError?.(msg);
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => { scannerRef.current?.stop().catch(() => {}); };
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          QR Code Direto
        </CardTitle>
        <CardDescription>
          Escaneie o QR Code — os dados sao buscados direto da SEFAZ
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div id="qr-reader-client" className="rounded-lg overflow-hidden" style={{ display: scanning ? "block" : "none" }} />
        {status && (
          <p className={`text-sm ${status.startsWith("Erro") ? "text-red-500" : "text-gray-600 dark:text-gray-400"}`}>{status}</p>
        )}
        <div className="flex gap-2">
          {!scanning && !loading ? (
            <Button onClick={startScanning} className="flex-1">Iniciar Leitura</Button>
          ) : loading ? (
            <Button disabled className="flex-1">Processando...</Button>
          ) : (
            <Button onClick={() => { stopScanning(); setStatus(""); }} variant="destructive" className="flex-1">Parar</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
