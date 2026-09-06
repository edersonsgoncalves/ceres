import { CategoryManager } from "@/components/CategoryManager";

export default function CategoriasPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Categorias</h1>
        <p className="text-gray-500">
          Gerencie as categorias de produtos
        </p>
      </div>

      <CategoryManager />
    </div>
  );
}
