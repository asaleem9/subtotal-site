// The running tape: a fixed receipt that accumulates line items as the visitor passes acts,
// becomes their own ledger at the peak, and doubles as navigation.
import { toCents, monthlyCents, yearlyCents, formatCents, suffix } from "./ledger-math.js";

const STORAGE_KEY = "subtotal-site.picks.v1";
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

export function createTape({ catalog, byId, onChange }) {
  const root = document.getElementById("tape");
  const list = root.querySelector("[data-tape-lines], .tape__lines");
  const titles = root.querySelectorAll("[data-tape-title]");
  const totals = root.querySelectorAll("[data-tape-total]");
  const dateEl = root.querySelector("[data-tape-date]");
  const clearBtn = root.querySelector("[data-tape-clear]");
  const toggle = root.querySelector(".tape__toggle");
  const cycleBtns = root.querySelectorAll("[data-cycle]");

  const state = { lines: [], memos: [], mode: "sample", cycle: "monthly" };
  const shown = { value: 0 }; // tween proxy for the rolling total
  let tween = null;

  dateEl.textContent = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  dateEl.setAttribute("datetime", new Date().toISOString().slice(0, 10));

  // --- model ----------------------------------------------------------------
  function lineFor(service, tier) {
    const t = tier || service.tiers.find((x) => x.name === service.defaultTierName) || null;
    const price = t ? t.price : service.defaultPrice;
    const cycle = t ? t.cycle : service.defaultCycle;
    const months = t ? t.customMonths : service.defaultCustomMonths;
    return { id: service.id, name: service.name, tier: t ? t.name : null, amountCents: toCents(price), cycle, customMonths: months };
  }
  function totalCents() {
    const f = state.cycle === "yearly" ? yearlyCents : monthlyCents;
    return state.lines.reduce((sum, l) => sum + f(l.amountCents, l.cycle, l.customMonths), 0);
  }
  function has(id) { return state.lines.some((l) => l.id === id); }

  // --- persistence ----------------------------------------------------------
  function save() {
    try {
      if (state.mode === "mine") localStorage.setItem(STORAGE_KEY, JSON.stringify(state.lines.map((l) => ({ id: l.id, tier: l.tier }))));
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* private mode, blocked storage: the page still works */ }
  }
  function restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const picks = JSON.parse(raw);
      const lines = [];
      for (const p of picks) {
        const s = byId.get(p.id);
        if (!s) continue;
        lines.push(lineFor(s, s.tiers.find((t) => t.name === p.tier) || s.tiers[0] || null));
      }
      if (!lines.length) return false;
      state.lines = lines; state.mode = "mine";
      return true;
    } catch { return false; }
  }

  // --- render ---------------------------------------------------------------
  function render(newId) {
    list.replaceChildren();
    for (const l of state.lines) {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tape__line" + (l.id === newId ? " tape__line--new" : "");
      b.dataset.id = l.id;
      const name = document.createElement("span");
      name.className = "tape__name";
      name.textContent = l.name;
      if (l.tier) { const s = document.createElement("small"); s.textContent = l.tier; name.appendChild(s); }
      const amt = document.createElement("span");
      amt.className = "tape__amt";
      amt.textContent = formatCents(l.amountCents) + suffix(l.cycle, l.customMonths);
      b.append(name, amt);
      b.title = state.mode === "mine" ? "Change plan or remove" : "Jump to this on the page";
      li.appendChild(b);
      list.appendChild(li);
    }
    for (const m of state.memos) {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tape__line tape__line--memo" + (m.id === newId ? " tape__line--new" : "");
      b.dataset.target = m.target;
      b.innerHTML = `<span class="tape__name"></span><span class="tape__amt"></span>`;
      b.firstChild.textContent = m.label;
      b.lastChild.textContent = m.value;
      li.appendChild(b);
      list.appendChild(li);
    }
    titles.forEach((t) => { t.textContent = state.mode === "mine" ? "Your ledger" : "Octo’s ledger"; });
    clearBtn.hidden = state.mode !== "mine";
    cycleBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cycle === state.cycle)));
    rollTo(totalCents());
    root.dataset.scVerifyState = `${state.lines.length + state.memos.length}:${totalCents()}:${state.mode}:${state.cycle}`;
    list.scrollTop = list.scrollHeight;
    onChange?.({ ...state, totalCents: totalCents() });
  }
  function paint(cents) { totals.forEach((t) => { t.textContent = formatCents(cents); }); }
  function rollTo(cents) {
    if (reduced || !window.gsap) { shown.value = cents; paint(cents); return; }
    tween?.kill();
    tween = gsap.to(shown, { value: cents, duration: 0.9, ease: "power3.out", onUpdate: () => paint(Math.round(shown.value)) });
  }

  // --- public API -----------------------------------------------------------
  const api = {
    state,
    has,
    totalCents,
    /** Sample lines printed by the page as acts pass (ignored once the visitor has picks). */
    printSample(service, tierName, customLine) {
      if (state.mode === "mine") return;
      if (customLine) { if (has(customLine.id)) return; state.lines.push(customLine); render(customLine.id); return; }
      if (has(service.id)) return;
      const tier = service.tiers.find((t) => t.name === tierName) || service.tiers[0] || null;
      state.lines.push(lineFor(service, tier));
      render(service.id);
    },
    printMemo(memo) {
      if (state.memos.some((m) => m.id === memo.id)) return;
      state.memos.push(memo);
      render(memo.id);
    },
    /** The visitor picks a service: the tape becomes theirs. */
    pick(service) {
      if (state.mode !== "mine") { state.lines = []; state.memos = []; state.mode = "mine"; }
      if (has(service.id)) return;
      state.lines.push(lineFor(service, service.tiers[0] || null));
      save(); render(service.id);
      if (toggle && matchMedia("(max-width: 1099px)").matches) api.open(true);
    },
    unpick(id) {
      state.lines = state.lines.filter((l) => l.id !== id);
      save(); render();
    },
    setTier(id, tierName) {
      const l = state.lines.find((x) => x.id === id); const s = byId.get(id);
      const t = s?.tiers.find((x) => x.name === tierName);
      if (!l || !t) return;
      Object.assign(l, { tier: t.name, amountCents: toCents(t.price), cycle: t.cycle, customMonths: t.customMonths });
      save(); render(id);
    },
    reset() { state.lines = []; state.memos = []; state.mode = "sample"; save(); render(); },
    open(v) { root.dataset.open = String(v); toggle?.setAttribute("aria-expanded", String(v)); },
  };

  // --- wiring ---------------------------------------------------------------
  cycleBtns.forEach((b) => b.addEventListener("click", () => { state.cycle = b.dataset.cycle; render(); }));
  clearBtn.addEventListener("click", () => api.reset());
  toggle?.addEventListener("click", () => api.open(root.dataset.open !== "true"));
  list.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.target) { document.getElementById(b.dataset.target)?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" }); return; }
    if (state.mode === "mine") { openTierMenu(b, b.dataset.id); return; }
    document.getElementById("forgot")?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
  });

  // A tiny inline plan menu: a <select> of the service's tiers plus Remove. Native controls, no library.
  function openTierMenu(button, id) {
    const s = byId.get(id); const l = state.lines.find((x) => x.id === id);
    if (!s || !l) return;
    const sel = document.createElement("select");
    sel.className = "tape__select";
    sel.setAttribute("aria-label", `Plan for ${s.name}`);
    for (const t of s.tiers) {
      const o = document.createElement("option");
      o.value = t.name; o.textContent = `${t.name} · ${formatCents(toCents(t.price))}${suffix(t.cycle, t.customMonths)}`;
      o.selected = t.name === l.tier;
      sel.appendChild(o);
    }
    const rm = document.createElement("option"); rm.value = "__remove"; rm.textContent = "Remove from ledger"; sel.appendChild(rm);
    sel.addEventListener("change", () => { sel.value === "__remove" ? api.unpick(id) : api.setTier(id, sel.value); });
    sel.addEventListener("blur", () => { if (sel.isConnected) render(); });
    button.replaceWith(sel); sel.focus();
    if ("showPicker" in sel) { try { sel.showPicker(); } catch { /* needs a gesture; the focused select still opens on Enter */ } }
  }

  const restored = restore();
  render();
  return Object.assign(api, { restored });
}
