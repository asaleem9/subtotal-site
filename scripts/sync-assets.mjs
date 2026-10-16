// Pulls brand material from the sibling app repo (../sub-manager) into this site.
// Octo poses -> assets/octo/*.webp, screenshots -> assets/shots/*.webp,
// logos -> assets/logos/<id>.<ext>, catalog -> data/catalog.json (slimmed).
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from "node:fs";
import { join, extname } from "node:path";
import sharp from "sharp";

const APP = process.env.SUBTOTAL_APP ?? join(process.cwd(), "..", "sub-manager");
const must = (p) => { if (!existsSync(p)) throw new Error(`missing: ${p}`); return p; };

// 1. Octo poses: the app's imagesets plus any new poses generated into design/poses.
const poseSources = [];
const mascot = must(join(APP, "Subtotal/Resources/Assets.xcassets/Mascot"));
for (const set of readdirSync(mascot).filter((d) => d.endsWith(".imageset"))) {
  const name = set.replace(".imageset", "");
  poseSources.push([name, join(mascot, set, `${name}@2x.png`)]);
}
if (existsSync("design/poses")) {
  for (const f of readdirSync("design/poses").filter((f) => f.endsWith(".png"))) {
    poseSources.push([f.replace(".png", ""), join("design/poses", f)]);
  }
}
mkdirSync("assets/octo", { recursive: true });
for (const [name, src] of poseSources) {
  if (!existsSync(src)) continue;
  for (const w of [400, 800]) {
    await sharp(src).resize({ width: w }).webp({ quality: 88, alphaQuality: 90 }).toFile(`assets/octo/${name}-${w}.webp`);
  }
}
console.log(`poses: ${poseSources.length}`);

// 2. App icon for favicon / social image.
const icon = must(join(APP, "Subtotal/Resources/Assets.xcassets/AppIcon.appiconset/app-icon.png"));
await sharp(icon).resize({ width: 512 }).png().toFile("assets/app-icon-512.png");
await sharp(icon).resize({ width: 180 }).png().toFile("assets/apple-touch-icon.png");

// 3. Screenshots, two widths each.
const shots = must(join(APP, "marketing/app-store-screenshots"));
mkdirSync("assets/shots", { recursive: true });
let shotCount = 0;
for (const f of readdirSync(shots).filter((f) => f.endsWith(".png"))) {
  const base = f.replace(".png", "");
  for (const w of [600, 1200]) {
    await sharp(join(shots, f)).resize({ width: w }).webp({ quality: 84 }).toFile(`assets/shots/${base}-${w}.webp`);
  }
  shotCount++;
}
console.log(`screenshots: ${shotCount}`);

// 4. Catalog + logos.
const catalog = JSON.parse(readFileSync(must(join(APP, "SubtotalShared/Sources/SubtotalShared/Resources/catalog.json")), "utf8"));
const logosRoot = must(join(APP, "SubtotalShared/Sources/SubtotalShared/Resources/Logos.xcassets"));
mkdirSync("assets/logos", { recursive: true });
let logoCount = 0;
const slim = catalog.services.map((s) => {
  let icon = null;
  if (s.iconAsset) {
    const setDir = join(logosRoot, `${s.iconAsset}.imageset`);
    const contents = join(setDir, "Contents.json");
    if (existsSync(contents)) {
      const img = JSON.parse(readFileSync(contents, "utf8")).images?.find((i) => i.filename);
      if (img) {
        const ext = extname(img.filename).toLowerCase();
        const out = `assets/logos/${s.id}${ext}`;
        copyFileSync(join(setDir, img.filename), out);
        icon = `${s.id}${ext}`;
        logoCount++;
      }
    }
  }
  return {
    id: s.id, name: s.name, category: s.category, brandHex: s.brandHex, popularity: s.popularity,
    defaultPrice: s.defaultPrice, defaultCycle: s.defaultCycle, defaultCustomMonths: s.defaultCustomMonths,
    tiers: s.tiers.map((t) => ({ name: t.name, price: t.price, cycle: t.cycle, customMonths: t.customMonths })),
    searchAliases: s.searchAliases, iconKind: s.iconKind, icon,
  };
});
mkdirSync("data", { recursive: true });
writeFileSync("data/catalog.json", JSON.stringify({ pricesAsOf: catalog.pricesAsOf, services: slim }));
console.log(`catalog: ${slim.length} services, ${logoCount} logos`);
