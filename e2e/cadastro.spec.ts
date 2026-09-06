import { test, expect } from "@playwright/test";

test.describe("Cadastro", () => {
  test("should display registration form", async ({ page }) => {
    await page.goto("/cadastro");

    await expect(page.getByText("Criar Conta")).toBeVisible();
    await expect(page.getByLabel("Nome")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
  });

  test("should navigate to login page", async ({ page }) => {
    await page.goto("/cadastro");

    await page.getByText("Já tem conta? Faça login").click();

    await expect(page).toHaveURL("/login");
  });

  test("should show error for empty fields", async ({ page }) => {
    await page.goto("/cadastro");

    await page.getByRole("button", { name: "Cadastrar" }).click();

    await expect(page.getByText("Nome é obrigatório")).toBeVisible();
  });
});
