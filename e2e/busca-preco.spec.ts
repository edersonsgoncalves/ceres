import { test, expect } from "@playwright/test";

test.describe("Busca de Preços", () => {
  test("should display search page", async ({ page }) => {
    await page.goto("/busca");

    await expect(page.getByText("Buscar Produtos")).toBeVisible();
    await expect(page.getByPlaceholder("Buscar produto por nome ou código de barras...")).toBeVisible();
  });

  test("should have search button", async ({ page }) => {
    await page.goto("/busca");

    await expect(page.getByRole("button", { name: "Buscar" })).toBeVisible();
  });

  test("should show results when searching", async ({ page }) => {
    await page.goto("/busca");

    await page.getByPlaceholder("Buscar produto por nome ou código de barras...").fill("arroz");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page.getByText("Nenhum produto encontrado")).toBeVisible();
  });
});
