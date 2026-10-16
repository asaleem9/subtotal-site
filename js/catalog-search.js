// Port of SubtotalShared/Catalog/CatalogSearch.swift. Same ladder, same constants:
// exact > name prefix > alias > word prefix > compact prefix > contains > fuzzy. Popularity breaks ties.

export function normalize(s) {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join(" ");
}

export function index(services) {
  return services.map((service) => {
    const name = normalize(service.name);
    return {
      service,
      name,
      compact: name.replace(/ /g, ""),
      words: name.split(" ").filter(Boolean),
      aliases: (service.searchAliases || []).map(normalize),
    };
  });
}

// Damerau–Levenshtein (optimal string alignment), capped.
function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev2 = new Array(b.length + 1).fill(0);
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  let cur = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    [prev2, prev, cur] = [prev, cur, prev2];
  }
  return prev[b.length];
}

function isSubsequence(q, s) {
  let i = 0;
  for (const ch of s) { if (i < q.length && ch === q[i]) i++; }
  return i === q.length;
}

function fuzzyScore(item, compactQuery) {
  const n = compactQuery.length;
  if (n < 3) return null;
  const allowed = n <= 4 ? 1 : n <= 8 ? 2 : 3;
  let best = null;
  const consider = (candidate, base) => {
    const prefix = candidate.slice(0, n);
    const d = editDistance(compactQuery, prefix, allowed);
    if (d <= allowed) {
      const s = base - d * 40;
      if (best === null || s > best) best = s;
    } else if (n >= 4 && isSubsequence(compactQuery, candidate)) {
      const s = base - 120;
      if (best === null || s > best) best = s;
    }
  };
  consider(item.compact, 420);
  for (const alias of item.aliases) consider(alias.replace(/ /g, ""), 380);
  for (const word of item.words.slice(1)) if (word.length >= 4) consider(word, 340);
  return best;
}

function score(item, query, compactQuery) {
  if (item.name === query) return [1000, false];
  if (item.aliases.some((a) => a === query)) return [950, false];
  if (item.name.startsWith(query)) return [900, false];
  if (item.aliases.some((a) => a.startsWith(query))) return [820, false];
  if (item.words.some((w) => w.startsWith(query))) return [700, false];
  if (item.compact.startsWith(compactQuery)) return [650, false];
  if (item.aliases.some((a) => a.replace(/ /g, "").startsWith(compactQuery))) return [640, false];
  const qWords = query.split(" ").filter(Boolean);
  if (qWords.length > 1 && qWords.every((q) => item.words.some((w) => w.startsWith(q)))) return [600, false];
  if (item.name.includes(query)) return [520, false];
  if (item.aliases.some((a) => a.includes(query))) return [480, false];
  const f = fuzzyScore(item, compactQuery);
  if (f !== null) return [f, true];
  return null;
}

export function matches(rawQuery, indexed, limit = 40) {
  const query = normalize(rawQuery);
  if (!query) return [];
  const compactQuery = query.replace(/ /g, "");
  const out = [];
  for (const item of indexed) {
    const r = score(item, query, compactQuery);
    if (r) out.push({ service: item.service, score: r[0], isFuzzy: r[1] });
  }
  out.sort((a, b) =>
    b.score - a.score ||
    a.service.popularity - b.service.popularity ||
    a.service.name.localeCompare(b.service.name));
  return out.slice(0, limit);
}
