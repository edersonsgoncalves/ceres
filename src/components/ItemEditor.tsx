"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InvoiceItem } from "@/types/invoice";

interface ItemEditorProps {
  item: InvoiceItem;
  index: number;
  onUpdate: (index: number, item: InvoiceItem) => void;
  onRemove: (index: number) => void;
  categories?: string[];
}

function formatPrice(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parsePrice(value: string): number {
  const cleaned = value.replace(/[^\d,]/g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

function PriceInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [display, setDisplay] = useState(formatPrice(value));

  const handleBlur = () => {
    const parsed = parsePrice(display);
    setDisplay(formatPrice(parsed));
    onChange(parsed);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplay(e.target.value);
  };

  return (
    <div className="relative">
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400">R$</span>
      <Input
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        className="h-8 w-28 pl-8 text-sm text-right"
      />
    </div>
  );
}

export function ItemEditor({ item, index, onUpdate, onRemove, categories = [] }: ItemEditorProps) {
  const [formData, setFormData] = useState(item);

  const allCategories = categories.length > 0 ? categories : [
    "Hortifrutii",
    "Carnes",
    "Laticinios",
    "Mercearia",
    "Limpeza",
    "Outros",
  ];

  const handleChange = (field: keyof InvoiceItem, value: string | number) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdate(index, updated);
  };

  return (
    <tr className="border-b">
      <td className="p-2">
        <Input
          value={formData.barcode || ""}
          onChange={(e) => handleChange("barcode", e.target.value)}
          placeholder="EAN"
          className="h-8 w-32 text-sm"
        />
      </td>
      <td className="p-2">
        <Input
          value={formData.name}
          onChange={(e) => handleChange("name", e.target.value)}
          className="h-8 text-sm"
        />
      </td>
      <td className="p-2">
        <Input
          type="number"
          value={formData.quantity}
          onChange={(e) => handleChange("quantity", Number(e.target.value))}
          className="h-8 w-20 text-sm"
          min="0"
          step="0.01"
        />
      </td>
      <td className="p-2">
        <Input
          value={formData.unit}
          onChange={(e) => handleChange("unit", e.target.value)}
          className="h-8 w-16 text-sm"
        />
      </td>
      <td className="p-2">
        <PriceInput value={formData.unitPrice} onChange={(v) => handleChange("unitPrice", v)} />
      </td>
      <td className="p-2">
        <PriceInput value={formData.totalPrice} onChange={(v) => handleChange("totalPrice", v)} />
      </td>
      <td className="p-2">
        <select
          value={formData.category || ""}
          onChange={(e) => handleChange("category", e.target.value)}
          className="h-8 w-full rounded border px-2 text-sm"
        >
          <option value="">Selecione...</option>
          {allCategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </td>
      <td className="p-2">
        <Button
          size="sm"
          variant="destructive"
          onClick={() => onRemove(index)}
        >
          Remover
        </Button>
      </td>
    </tr>
  );
}
