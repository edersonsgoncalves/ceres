export async function lookupBarcode(
  barcode: string
): Promise<{ name: string; category?: string } | null> {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.status === 0) {
      return null;
    }

    const product = data.product;
    const name = product.product_name || product.product_name_en || null;

    if (!name) {
      return null;
    }

    let category: string | undefined;
    const categories = product.categories || "";
    if (categories.toLowerCase().includes("fruit")) {
      category = "Hortifrúti";
    } else if (categories.toLowerCase().includes("meat")) {
      category = "Carnes";
    } else if (categories.toLowerCase().includes("dairy")) {
      category = "Laticínios";
    } else if (categories.toLowerCase().includes("cleaning")) {
      category = "Limpeza";
    } else {
      category = "Mercearia";
    }

    return { name, category };
  } catch (error) {
    console.error("Erro ao buscar código de barras:", error);
    return null;
  }
}
