// Act 1: the six blank cards Octo holds in the hero drawing get real logos. Positions are
// measured once from the 1024px master (centre x, centre y, rotation) and expressed in percent
// so the tiles track the image at any size. Then they stamp in with a short stagger.
import { tile } from "./tiles.js";

const CARDS = [
  { x: 33.7, y: 15.6, rot: -14 },
  { x: 65.0, y: 15.1, rot: 8 },
  { x: 13.7, y: 32.2, rot: -20 },
  { x: 85.5, y: 34.2, rot: 17 },
  { x: 13.7, y: 63.5, rot: -18 },
  { x: 86.4, y: 64.5, rot: 16 },
];
const HERO_IDS = ["netflix", "spotify", "chatgpt", "youtube-premium", "xbox-game-pass", "the-new-york-times"];

export function mountHero({ byId }) {
  const host = document.getElementById("hero-tiles");
  if (!host) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tiles = [];
  HERO_IDS.forEach((id, i) => {
    const s = byId.get(id); const c = CARDS[i];
    if (!s || !c) return;
    const wrap = document.createElement("span");
    wrap.className = "scene__tile";
    wrap.style.left = `${c.x}%`; wrap.style.top = `${c.y}%`; wrap.style.setProperty("--rot", `${c.rot}deg`);
    wrap.appendChild(tile(s));
    host.appendChild(wrap);
    tiles.push(wrap);
  });
  if (reduced || !window.gsap) { tiles.forEach((t) => { t.style.opacity = 1; t.style.transform = `translate(-50%,-50%) rotate(${t.style.getPropertyValue("--rot")}) scale(1)`; }); return; }
  gsap.to(tiles, {
    opacity: 1, scale: 1, duration: 0.55, ease: "back.out(2.2)", stagger: 0.07, delay: 0.25,
    transformOrigin: "50% 50%",
    // GSAP owns the transform from here; keep the centring and rotation it started with.
    onStart() { tiles.forEach((t) => gsap.set(t, { xPercent: -50, yPercent: -50, rotation: parseFloat(t.style.getPropertyValue("--rot")), scale: 0.95 })); },
  });
}
