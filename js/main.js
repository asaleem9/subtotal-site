import { APP_STORE_URL, CTA_LABEL } from "./site-config.js";
import { createTape } from "./tape.js";
import { mountHero } from "./hero.js";
import { mountPicker } from "./picker.js";
import { toCents } from "./ledger-math.js";
import { formatCents } from "./ledger-math.js";

// The demo ledger from the app's DemoSeeder: ten catalog picks plus one custom line.
const SAMPLE = [
  ["netflix", "Standard"], ["spotify", "Premium Individual"], ["chatgpt", "Plus"], ["icloud-plus", "200GB"],
  ["amazon-prime", "Annual"], ["youtube-premium", "Individual"], ["xbox-game-pass", "Ultimate"],
  ["the-new-york-times", "All Access"], ["planet-fitness", "Black Card"], ["1password", "Families (yearly)"],
];
const ELECTRIC = { id: "custom-electric", name: "Electric bill", tier: "custom", amountCents: 14200, cycle: "monthly", customMonths: 1 };
const MEMOS = [
  { id: "memo-app", label: "Subtotal, the app", value: "$0.00", target: "facts-title" },
  { id: "memo-bank", label: "Bank linking", value: "none", target: "facts-title" },
  { id: "memo-account", label: "Account", value: "none", target: "facts-title" },
  { id: "memo-analytics", label: "Analytics", value: "none", target: "facts-title" },
];

document.querySelectorAll("[data-cta]").forEach((a) => { a.href = APP_STORE_URL; a.textContent = CTA_LABEL; });

const res = await fetch("/data/catalog.json");
const { services: catalog } = await res.json();
const byId = new Map(catalog.map((s) => [s.id, s]));

const totalEls = document.querySelectorAll("[data-total]");
const totalCycle = document.querySelectorAll("[data-total-cycle]");
const totalLine = document.querySelector("[data-total-line]");
const tape = createTape({
  catalog, byId,
  onChange(s) {
    totalEls.forEach((el) => { el.textContent = formatCents(s.totalCents); });
    totalCycle.forEach((el) => { el.textContent = s.cycle === "yearly" ? "a year" : "a month"; });
    if (totalLine) totalLine.textContent = s.mode === "mine"
      ? (s.lines.length === 1 ? "One line so far. The app keeps the rest." : "That’s your number. Now put it somewhere you’ll see it.")
      : "That’s Octo’s number. Yours is a few taps away.";
  },
});
mountHero({ byId });
const picker = mountPicker({ catalog, byId, tape });

// Sample lines print as act 2 progresses; memos as act 4 comes into view.
const forgot = document.getElementById("forgot");
const facts = document.querySelector("[data-tape-memo]");
let printed = 0, memoed = 0;
function readP(el) { const v = el?.style.getPropertyValue("--sc-p"); return v ? parseFloat(v) : 0; }
function tick() {
  if (tape.state.mode !== "mine") {
    const p = readP(forgot);
    const want = Math.min(11, Math.floor(p * 11 / 0.72) + (p > 0.02 ? 1 : 0));
    while (printed < want) {
      if (printed < SAMPLE.length) { const [id, tier] = SAMPLE[printed]; const s = byId.get(id); if (s) tape.printSample(s, tier); }
      else tape.printSample(null, null, ELECTRIC);
      printed++;
    }
    const q = readP(facts);
    const wantMemo = q > 0.15 ? Math.min(MEMOS.length, Math.floor((q - 0.15) * 12)) : 0;
    while (memoed < wantMemo) tape.printMemo(MEMOS[memoed++]);
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// Keyboard: the picker lives on a pinned act, so focusing the field parks the act where the
// stage is fully on screen (the browser's own scroll-into-view would park it at progress 0).
const build = document.getElementById("build");
document.getElementById("catalog-search")?.addEventListener("focus", () => {
  const rect = build.getBoundingClientRect();
  const travel = rect.height - innerHeight;
  const target = scrollY + rect.top + travel * 0.25;
  if (Math.abs(target - scrollY) > 4) scrollTo({ top: target, behavior: "instant" });
});

// Hero/clip posters and the tape total also read the restored state on load.
if (tape.restored) picker?.refresh();
