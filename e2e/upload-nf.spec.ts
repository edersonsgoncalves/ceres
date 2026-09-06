import { test, expect } from "@playwright/test";

test.describe("Upload de Nota Fiscal", () => {
  test("should display upload form", async ({ page }) => {
    await page.goto("/notas-fiscais/nova");

    await expect(page.getByText("Nova Nota Fiscal")).toBeVisible();
    await expect(page.getByText("Arraste e solte a imagem aqui")).toBeVisible();
  });

  test("should have file input", async ({ page }) => {
    await page.goto("/notas-fiscais/nova");

    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeHidden();
  });

  test("should show preview when file is selected", async ({ page }) => {
    await page.goto("/notas-fiscais/nova");

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "test.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("test"),
    });

    await expect(page.getByText("Preview da imagem")).toBeVisible();
  });
});
