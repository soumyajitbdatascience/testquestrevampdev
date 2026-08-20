import type { Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * Numbered screenshots, so the artifacts folder reads as a walkthrough of the
 * journey rather than a bag of PNGs.
 */
const DIR = "e2e/artifacts/admin";
let seq = 0;

export async function shot(page: Page, name: string) {
  mkdirSync(DIR, { recursive: true });
  seq += 1;
  const file = `${DIR}/${String(seq).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  return file;
}
