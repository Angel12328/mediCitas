import { test, expect } from "@playwright/test";

test.describe("Agendar cita - Auth redirect", () => {
  test("redirects unauthenticated user to login", async ({ page }) => {
    await page.goto("/citas/agendar");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page shows next param for agendar", async ({ page }) => {
    await page.goto("/citas/agendar");
    await expect(page).toHaveURL(/next=%2Fcitas%2Fagendar/);
  });
});
