"use client";

interface ImagePreviewProps {
  file: File | null;
  previewUrl: string | null;
}

export function ImagePreview({ file, previewUrl }: ImagePreviewProps) {
  if (!file || !previewUrl) return null;

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          Preview da imagem
        </span>
        <span className="text-xs text-gray-500">
          {(file.size / 1024 / 1024).toFixed(2)} MB
        </span>
      </div>
      <div className="relative overflow-hidden rounded-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt="Preview da nota fiscal"
          className="w-full object-contain"
          style={{ maxHeight: "500px" }}
        />
      </div>
    </div>
  );
}
