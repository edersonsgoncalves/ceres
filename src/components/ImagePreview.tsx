"use client";

interface ImagePreviewProps {
  files: File[];
  previewUrls: string[];
  onRemove?: (index: number) => void;
}

export function ImagePreview({ files, previewUrls, onRemove }: ImagePreviewProps) {
  if (files.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-neutral-700 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {files.length} {files.length === 1 ? "imagem" : "imagens"} selecionada{files.length > 1 ? "s" : ""}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024 < 1
            ? `${(files.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(0)} KB`
            : `${(files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2)} MB`}
        </span>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: previewUrls.length > 1 ? "repeat(auto-fill, minmax(140px, 1fr))" : "1fr" }}>
        {previewUrls.map((url, i) => (
          <div key={i} className="relative overflow-hidden rounded-md border border-gray-200 dark:border-neutral-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Preview ${i + 1}`}
              className="w-full object-contain"
              style={{ maxHeight: previewUrls.length > 1 ? "180px" : "400px" }}
            />
            <div className="absolute top-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
              {i + 1}
            </div>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs hover:bg-red-600"
              >
                x
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
