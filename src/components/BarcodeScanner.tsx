"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BarcodeScannerProps {
  onScan?: (barcode: string) => void;
}

export function BarcodeScanner({ onScan }: BarcodeScannerProps) {
  const [mode, setMode] = useState<"camera" | "manual">("manual");
  const [manualBarcode, setManualBarcode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setMode("camera");
      setScanning(true);
      setError("");
    } catch {
      setError("Não foi possível acessar a câmera. Use a digitação manual.");
      setMode("manual");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualBarcode.trim()) {
      onScan?.(manualBarcode.trim());
      setManualBarcode("");
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Leitor de Código de Barras</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant={mode === "manual" ? "default" : "outline"}
            onClick={() => {
              stopCamera();
              setMode("manual");
            }}
          >
            Digitação Manual
          </Button>
          <Button
            variant={mode === "camera" ? "default" : "outline"}
            onClick={startCamera}
          >
            Câmera
          </Button>
        </div>

        {mode === "manual" && (
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <Input
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              placeholder="Digite o código de barras"
              className="flex-1"
            />
            <Button type="submit">Buscar</Button>
          </form>
        )}

        {mode === "camera" && (
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-lg bg-black">
              <video
                ref={videoRef}
                className="w-full"
                playsInline
                muted
              />
              {scanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-0.5 w-3/4 animate-pulse bg-red-500" />
                </div>
              )}
            </div>
            <Button variant="outline" onClick={stopCamera}>
              Parar Câmera
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <p className="text-xs text-gray-500">
          Posicione o código de barras na câmera ou digite manualmente.
        </p>
      </CardContent>
    </Card>
  );
}
