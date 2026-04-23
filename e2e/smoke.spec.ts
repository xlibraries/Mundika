import { expect, test } from "@playwright/test";

test("home shows brand and khatta positioning", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("MUNDIKA").first()).toBeVisible();
  await expect(page.getByText("seedha khatta", { exact: false })).toBeVisible();
});

test("login page shows Google and email sign-in", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: /Continue with Google/i })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Continue with email/i })
  ).toBeVisible();
});

test("login accepts next return path", async ({ page }) => {
  await page.goto("/login?next=%2Fdashboard");
  await expect(page.getByRole("heading", { name: /^Sign in$/ })).toBeVisible();
  await expect(page).toHaveURL(/[?&]next=/);
});
