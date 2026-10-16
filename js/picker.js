// Act 5: the real catalog, searchable, feeding the tape.
import { index, matches } from "./catalog-search.js";
import { tile } from "./tiles.js";
import { toCents, formatCents, suffix } from "./ledger-math.js";

export function mountPicker({ catalog, byId, tape }) {
  const input = document.getElementById("catalog-search");
  const results = document.getElementById("results");
  const popular = document.getElementById("popular");
  if (!input) return;
  const indexed = index(catalog);
  const POPULAR = catalog.filter((s) => s.popularity === 1).slice(0, 12);

  function row(service) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button"; b.className = "result" + (tape.has(service.id) ? " result--on" : "");
    b.dataset.id = service.id;
    b.setAttribute("aria-pressed", String(tape.has(service.id)));
    const t = service.tiers[0];
    const name = document.createElement("span"); name.className = "result__name"; name.textContent = service.name;
    if (t) { const tier = document.createElement("span"); tier.className = "result__tier"; tier.textContent = t.name; name.appendChild(tier); }
    const price = document.createElement("span"); price.className = "result__price";
    price.textContent = tape.has(service.id) ? "On ledger" : (t ? formatCents(toCents(t.price)) + suffix(t.cycle, t.customMonths) : "");
    b.append(tile(service), name, price);
    li.appendChild(b);
    return li;
  }
  function empty(q) {
    const li = document.createElement("li"); li.className = "results__empty";
    const img = document.createElement("img"); img.src = "/assets/octo/octo-magnify-400.webp"; img.alt = ""; img.width = 72; img.height = 72;
    const p = document.createElement("p"); p.textContent = `Nothing called “${q}” in the catalog. In the app you can add anything as a custom service.`;
    li.append(img, p); return li;
  }
  function renderResults() {
    const q = input.value.trim();
    results.replaceChildren();
    popular.hidden = Boolean(q);
    if (!q) return;
    const hits = matches(q, indexed, 8);
    if (!hits.length) { results.appendChild(empty(q)); return; }
    hits.forEach((h) => results.appendChild(row(h.service)));
  }
  function renderPopular() {
    popular.replaceChildren();
    for (const s of POPULAR) {
      const b = document.createElement("button");
      b.type = "button"; b.dataset.id = s.id;
      b.setAttribute("aria-pressed", String(tape.has(s.id)));
      b.setAttribute("aria-label", `${s.name}${tape.has(s.id) ? ", on ledger" : ""}`);
      const label = document.createElement("span"); label.textContent = s.name;
      b.append(tile(s), label);
      popular.appendChild(b);
    }
  }
  function toggle(id) {
    const s = byId.get(id); if (!s) return;
    if (tape.state.mode === "mine" && tape.has(id)) tape.unpick(id); else tape.pick(s);
    renderResults(); renderPopular();
  }

  let timer = 0;
  input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(renderResults, 60); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { const first = results.querySelector(".result"); if (first) { toggle(first.dataset.id); e.preventDefault(); } }
    if (e.key === "ArrowDown") { results.querySelector(".result")?.focus(); e.preventDefault(); }
  });
  results.addEventListener("click", (e) => { const b = e.target.closest(".result"); if (b) toggle(b.dataset.id); });
  popular.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) toggle(b.dataset.id); });
  renderPopular();
  return { refresh() { renderResults(); renderPopular(); } };
}
