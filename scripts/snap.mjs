// Quick look: screenshot the page at a few scroll positions with real Chrome.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
const [,, url = "http://localhost:4500", out = "scrollcraft/lab/snap", width = "1440", height = "900", reduced = ""] = process.argv;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: +width, height: +height }, deviceScaleFactor: 1, reducedMotion: reduced ? "reduce" : "no-preference" });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("requestfailed", (r) => errors.push("FAILED " + r.url()));
page.on("response", (r) => { if (r.status() >= 400) errors.push(r.status() + " " + r.url()); });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const total = await page.evaluate(() => document.documentElement.scrollHeight);
const steps = +(process.env.STEPS || 14);
for (let i = 0; i <= steps; i++) {
  const y = Math.round((total - +height) * i / steps);
  await page.evaluate((y) => scrollTo(0, y), y);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${out}/${String(i).padStart(2, "0")}-${y}.png` });
}
console.log(JSON.stringify({ total, vh: +height, pages: (total / +height).toFixed(1), errors }, null, 1));
await browser.close();
