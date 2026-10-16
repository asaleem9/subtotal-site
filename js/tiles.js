// One tile renderer for every logo on the page, mirroring the app's LogoTile cases:
// glyph (white Simple Icons mask on the brand colour), image (the service's own icon on a
// 12% brand tint), monogram (first letter on the brand colour).
const DARK_GLYPH = new Set(); // brands whose glyph needs ink instead of white (none so far)

function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return 0.3;
  const n = parseInt(m[1], 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function tile(service) {
  const el = document.createElement("span");
  const brand = service.brandHex || "#6B655C";
  el.className = "tile";
  el.style.setProperty("--brand", brand);
  const light = luminance(brand) > 0.6;
  if (service.icon && service.iconKind === "glyph") {
    el.classList.add("tile--glyph");
    if (light || DARK_GLYPH.has(service.id)) el.classList.add("tile--dark-glyph");
    const g = document.createElement("span");
    g.className = "tile__glyph";
    g.style.setProperty("--logo", `url("/assets/logos/${service.icon}")`);
    el.appendChild(g);
  } else if (service.icon) {
    el.classList.add("tile--image");
    const img = document.createElement("img");
    img.src = `/assets/logos/${service.icon}`;
    img.alt = "";
    img.width = 64; img.height = 64;
    img.loading = "lazy";
    img.decoding = "async";
    el.appendChild(img);
  } else {
    el.classList.add("tile--monogram");
    if (light) el.classList.add("tile--dark-glyph");
    el.textContent = service.name.slice(0, 1).toUpperCase();
  }
  return el;
}
