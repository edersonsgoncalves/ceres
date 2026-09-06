"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number, city: string, state: string) => void;
}

export function LocationPicker({ onLocationSelect }: LocationPickerProps) {
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocalização não suportada pelo navegador");
      return;
    }

    setLoading(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onLocationSelect(latitude, longitude, city || "São Paulo", state || "SP");
        setLoading(false);
      },
      (err) => {
        setError("Não foi possível obter a localização. Preencha manualmente.");
        setLoading(false);
      }
    );
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!city || !state) {
      setError("Preencha cidade e estado");
      return;
    }
    onLocationSelect(0, 0, city, state);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleGeolocation}
          disabled={loading}
        >
          {loading ? "Obtendo localização..." : "Usar minha localização"}
        </Button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-gray-500">ou selecione manualmente</span>
        </div>
      </div>

      <form onSubmit={handleManualSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Cidade</label>
            <Input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ex: São Paulo"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Estado</label>
            <Input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="Ex: SP"
              maxLength={2}
            />
          </div>
        </div>
        <Button type="submit" variant="secondary">
          Confirmar localização
        </Button>
      </form>
    </div>
  );
}
