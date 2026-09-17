"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { TextDecoder } = require("util");

const DEFAULT_TARGETS = ["places.json", "data/places.json"];
const DEFAULT_APP_SOURCE = "app.js";

const UTF8_DECODER = new TextDecoder("utf-8");
const DECODER_SPECS = [
  { label: "utf-8", decoder: new TextDecoder("utf-8") },
  { label: "windows-1251", decoder: new TextDecoder("windows-1251") },
  { label: "koi8-r", decoder: new TextDecoder("koi8-r") },
  { label: "latin1", decoder: new TextDecoder("iso-8859-1") }
];

const CP1251_SPECIALS = new Map(
  Object.entries({
    0x0402: 0x80,
    0x0403: 0x81,
    0x201A: 0x82,
    0x0453: 0x83,
    0x201E: 0x84,
    0x2026: 0x85,
    0x2020: 0x86,
    0x2021: 0x87,
    0x20AC: 0x88,
    0x2030: 0x89,
    0x0409: 0x8a,
    0x2039: 0x8b,
    0x040A: 0x8c,
    0x040C: 0x8d,
    0x040B: 0x8e,
    0x040F: 0x8f,
    0x0452: 0x90,
    0x2018: 0x91,
    0x2019: 0x92,
    0x201C: 0x93,
    0x201D: 0x94,
    0x2022: 0x95,
    0x2013: 0x96,
    0x2014: 0x97,
    0x2122: 0x99,
    0x0459: 0x9a,
    0x203A: 0x9b,
    0x045A: 0x9c,
    0x045C: 0x9d,
    0x045B: 0x9e,
    0x045F: 0x9f,
    0x00A0: 0xa0,
    0x040E: 0xa1,
    0x045E: 0xa2,
    0x0408: 0xa3,
    0x00A4: 0xa4,
    0x0490: 0xa5,
    0x00A6: 0xa6,
    0x00A7: 0xa7,
    0x0401: 0xa8,
    0x00A9: 0xa9,
    0x0404: 0xaa,
    0x00AB: 0xab,
    0x00AC: 0xac,
    0x00AD: 0xad,
    0x00AE: 0xae,
    0x0407: 0xaf,
    0x00B0: 0xb0,
    0x00B1: 0xb1,
    0x0406: 0xb2,
    0x0456: 0xb3,
    0x0491: 0xb4,
    0x00B5: 0xb5,
    0x00B6: 0xb6,
    0x00B7: 0xb7,
    0x0451: 0xb8,
    0x2116: 0xb9,
    0x0454: 0xba,
    0x00BB: 0xbb,
    0x0458: 0xbc,
    0x0405: 0xbd,
    0x0455: 0xbe,
    0x0457: 0xbf
  }).map(([codePoint, byte]) => [Number(codePoint), byte])
);

function main() {
  const args = process.argv.slice(2);
  const appSourceArg = args.find((arg) => arg.startsWith("--app="));
  const rawTargets = args.filter((arg) => !arg.startsWith("--"));

  const appSourcePath = path.resolve(
    process.cwd(),
    appSourceArg ? appSourceArg.slice("--app=".length) : DEFAULT_APP_SOURCE
  );

  const targets = (rawTargets.length > 0 ? rawTargets : DEFAULT_TARGETS)
    .map((target) => path.resolve(process.cwd(), target))
    .filter((targetPath) => fs.existsSync(targetPath));

  if (targets.length === 0) {
    console.error("[fix-encoding] No target files found.");
    process.exitCode = 1;
    return;
  }

  const seedMap = buildSeedMap(appSourcePath);
  const seedPoints = buildSeedPoints(seedMap);

  for (const targetPath of targets) {
    try {
      processTarget(targetPath, seedMap, seedPoints);
    } catch (error) {
      console.error(`[fix-encoding] ${path.relative(process.cwd(), targetPath)}: ${error.message}`);
      process.exitCode = 1;
    }
  }
}

function processTarget(targetPath, seedMap, seedPoints) {
  const sourceBytes = fs.readFileSync(targetPath);
  const candidates = buildDecodeCandidates(sourceBytes);
  const best = selectBestArrayCandidate(candidates);

  if (!best) {
    throw new Error("unable to decode valid JSON array from known encodings");
  }

  const repaired = best.data.map((item) => {
    const place = repairValue(item);
    if (!place || typeof place !== "object") {
      return place;
    }

    const id = normalizeText(place.id, "");
    const seed = id ? seedMap.get(id) : null;
    if (seed) {
      mergeSeedText(place, seed);
      const title = normalizeText(place.title, "");
      if ((!title || hasReplacementChar(title)) && normalizeText(seed.name, "")) {
        place.title = seed.name;
      }
    } else if (hasReplacementInPlace(place)) {
      applySeedFallbackForBrokenPlace(place, nearestSeedPoint(place, seedPoints));
    }

    cleanupBrokenTextFields(place);
    return place;
  });

  fs.writeFileSync(targetPath, `${JSON.stringify(repaired, null, 2)}\n`, "utf8");
  const unresolved = findUnresolvedPlaceIds(repaired);
  console.log(
    `[fix-encoding] ${path.relative(process.cwd(), targetPath)} -> ${best.name}, items=${repaired.length}`
  );
  if (unresolved.length > 0) {
    console.warn(
      `[fix-encoding] ${path.relative(process.cwd(), targetPath)} unresolved replacement chars for ids: ${unresolved.join(", ")}`
    );
  }
}

function buildDecodeCandidates(sourceBytes) {
  const candidates = [];
  const seen = new Set();

  const add = (name, text) => {
    if (typeof text !== "string" || text.length === 0 || seen.has(text)) {
      return;
    }
    seen.add(text);
    candidates.push({
      name,
      text,
      score: scoreText(text)
    });
  };

  for (const { label, decoder } of DECODER_SPECS) {
    const decoded = decoder.decode(sourceBytes);
    add(`decode:${label}`, decoded);

    const cp = reverseMojibakeCp1251(decoded);
    add(`reverse-cp1251(${label})`, cp);

    const latin = reverseMojibakeLatin1(decoded);
    add(`reverse-latin1(${label})`, latin);

    if (latin) {
      add(`reverse-cp1251(reverse-latin1(${label}))`, reverseMojibakeCp1251(latin));
    }
    if (cp) {
      add(`reverse-latin1(reverse-cp1251(${label}))`, reverseMojibakeLatin1(cp));
    }
  }

  return candidates.sort((left, right) => right.score - left.score);
}

function selectBestArrayCandidate(candidates) {
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate.text);
      if (Array.isArray(parsed)) {
        return {
          ...candidate,
          data: parsed
        };
      }
    } catch {
      // Keep scanning lower scored candidates.
    }
  }
  return null;
}

function scoreText(text) {
  const russianCount = countMatches(text, /[\u0410-\u044F\u0401\u0451]/g);
  const cyrillicCount = countMatches(text, /[\u0400-\u04FF]/g);
  const weirdCyrillicCount = Math.max(0, cyrillicCount - russianCount);
  const replacementCount = countMatches(text, /\uFFFD/g);
  const pijsCount = countMatches(text, /\u043F\u0457\u0405/g);

  let score = (russianCount * 3) - (weirdCyrillicCount * 4) - (replacementCount * 120) - (pijsCount * 120);

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      score += 200000 + (parsed.length * 5);
    } else {
      score += 100000;
    }
  } catch {
    score -= 10000;
  }

  return score;
}

function countMatches(text, regex) {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function repairValue(value) {
  if (typeof value === "string") {
    return repairString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => repairValue(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const result = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    result[key] = repairValue(fieldValue);
  }
  return result;
}

function repairString(value) {
  const candidates = [];
  const seen = new Set();

  const add = (candidate) => {
    if (typeof candidate !== "string" || seen.has(candidate)) {
      return;
    }
    seen.add(candidate);
    candidates.push(candidate);
  };

  add(value);
  add(sanitizeReplacementText(value));
  const cp = reverseMojibakeCp1251(value);
  const latin = reverseMojibakeLatin1(value);
  add(cp);
  add(latin);
  add(cp ? reverseMojibakeCp1251(cp) : null);
  add(latin ? reverseMojibakeLatin1(latin) : null);
  add(cp ? reverseMojibakeLatin1(cp) : null);
  add(latin ? reverseMojibakeCp1251(latin) : null);

  let best = value;
  let bestScore = scoreFragment(value);

  for (const candidate of candidates) {
    const score = scoreFragment(candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

function reverseMojibakeCp1251(text) {
  const cp1251Bytes = encodeToCp1251(text);
  if (!cp1251Bytes) {
    return null;
  }
  return UTF8_DECODER.decode(cp1251Bytes);
}

function reverseMojibakeLatin1(text) {
  const bytes = [];
  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (!Number.isFinite(codePoint) || codePoint > 0xff) {
      return null;
    }
    bytes.push(codePoint);
  }
  return UTF8_DECODER.decode(Uint8Array.from(bytes));
}

function scoreFragment(text) {
  const russianCount = countMatches(text, /[\u0410-\u044F\u0401\u0451]/g);
  const cyrillicCount = countMatches(text, /[\u0400-\u04FF]/g);
  const weirdCyrillicCount = Math.max(0, cyrillicCount - russianCount);
  const replacementCount = countMatches(text, /\uFFFD/g);
  const pijsCount = countMatches(text, /\u043F\u0457\u0405/g);
  return (russianCount * 3) - (weirdCyrillicCount * 4) - (replacementCount * 120) - (pijsCount * 120);
}

function sanitizeReplacementText(text) {
  if (typeof text !== "string" || text.length === 0) {
    return text;
  }
  return text
    .replace(/\uFFFD+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[,;:\-.]+/, "")
    .replace(/[,;:\-.]+$/, "");
}

function encodeToCp1251(text) {
  const bytes = [];
  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (!Number.isFinite(codePoint)) {
      return null;
    }

    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
      continue;
    }

    if (codePoint >= 0x0410 && codePoint <= 0x044f) {
      bytes.push(codePoint - 0x350);
      continue;
    }

    const mapped = CP1251_SPECIALS.get(codePoint);
    if (mapped !== undefined) {
      bytes.push(mapped);
      continue;
    }

    return null;
  }

  return Uint8Array.from(bytes);
}

function buildSeedMap(appSourcePath) {
  const seedMap = new Map();
  if (!appSourcePath || !fs.existsSync(appSourcePath)) {
    return seedMap;
  }

  const source = fs.readFileSync(appSourcePath, "utf8");
  const baseLiteral = extractLiteral(source, "const BaseSeedPlaces = Object.freeze(", "[", "]");
  const detailsLiteral = extractLiteral(source, "const SeedPlaceDetails = Object.freeze(", "{", "}");

  if (!baseLiteral || !detailsLiteral) {
    return seedMap;
  }

  let basePlaces;
  let seedDetails;
  try {
    basePlaces = evaluateLiteral(baseLiteral);
    seedDetails = evaluateLiteral(detailsLiteral);
  } catch {
    return seedMap;
  }

  if (!Array.isArray(basePlaces) || !seedDetails || typeof seedDetails !== "object") {
    return seedMap;
  }

  for (const place of basePlaces) {
    if (!place || typeof place !== "object") {
      continue;
    }
    const id = normalizeText(place.id, "");
    if (!id) {
      continue;
    }

    const merged = {
      ...place,
      ...(seedDetails[id] || {})
    };
    seedMap.set(id, repairValue(merged));
  }

  return seedMap;
}

function buildSeedPoints(seedMap) {
  const points = [];
  for (const seed of seedMap.values()) {
    if (!seed || typeof seed !== "object") {
      continue;
    }

    const lat = Number(seed.lat);
    const lon = Number(seed.lon ?? seed.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      continue;
    }

    points.push({
      lat,
      lon,
      city: extractCityToken(seed.name),
      country: normalizeText(seed.country, ""),
      region: normalizeText(seed.region, "")
    });
  }
  return points;
}

function nearestSeedPoint(place, seedPoints) {
  if (!Array.isArray(seedPoints) || seedPoints.length === 0) {
    return null;
  }

  const lat = Number(place?.lat);
  const lon = Number(place?.lon ?? place?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  let nearest = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const point of seedPoints) {
    const distance = haversineDistanceKm(lat, lon, point.lat, point.lon);
    if (!Number.isFinite(distance)) {
      continue;
    }
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = point;
    }
  }

  return nearest;
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    (Math.sin(dLat / 2) ** 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * (Math.sin(dLon / 2) ** 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

function extractCityToken(name) {
  const text = normalizeText(name, "");
  if (!text) {
    return "";
  }
  return text.split(",")[0].trim();
}

function extractLiteral(source, marker, openChar, closeChar) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  const start = source.indexOf(openChar, markerIndex);
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let stringQuote = "";
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === stringQuote) {
        inString = false;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      inString = true;
      stringQuote = char;
      continue;
    }

    if (char === openChar) {
      depth += 1;
      continue;
    }

    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return null;
}

function evaluateLiteral(literal) {
  return vm.runInNewContext(`(${literal})`, Object.create(null), { timeout: 250 });
}

function mergeSeedText(targetPlace, seedPlace) {
  for (const [key, value] of Object.entries(seedPlace)) {
    if (key === "id") {
      continue;
    }
    if (isTextualValue(value)) {
      targetPlace[key] = value;
    }
  }
}

function isTextualValue(value) {
  if (typeof value === "string") {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every((item) => typeof item === "string");
  }
  if (!value || typeof value !== "object") {
    return false;
  }
  return Object.values(value).every((field) => isTextualValue(field));
}

function hasReplacementChar(text) {
  return typeof text === "string" && text.includes("\uFFFD");
}

function normalizeText(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }
  return value;
}

function hasReplacementInPlace(place) {
  if (!place || typeof place !== "object") {
    return false;
  }
  const fields = ["name", "title", "country", "region", "city", "description", "funFact"];
  return fields.some((key) => hasReplacementChar(normalizeText(place[key], "")));
}

function applySeedFallbackForBrokenPlace(place, seedPoint) {
  if (!place || typeof place !== "object") {
    return;
  }

  for (const key of ["country", "region", "city"]) {
    const text = normalizeText(place[key], "");
    if (!hasReplacementChar(text)) {
      continue;
    }
    const fallback = seedPoint ? normalizeText(seedPoint[key], "") : "";
    place[key] = fallback || sanitizeReplacementText(text);
  }

  for (const key of ["name", "title"]) {
    const text = normalizeText(place[key], "");
    if (!hasReplacementChar(text)) {
      continue;
    }

    const cleaned = sanitizeReplacementText(text);
    const prefix = normalizeText(cleaned.split(",")[0], "").trim();
    const city = seedPoint ? normalizeText(seedPoint.city, "") : "";
    if (prefix && city) {
      place[key] = `${prefix}, ${city}`;
    } else if (prefix) {
      place[key] = prefix;
    } else if (city) {
      place[key] = city;
    } else {
      place[key] = cleaned;
    }
  }
}

function cleanupBrokenTextFields(place) {
  if (!place || typeof place !== "object") {
    return;
  }

  for (const key of ["name", "title", "country", "region", "city", "description", "funFact"]) {
    if (typeof place[key] === "string") {
      place[key] = sanitizeReplacementText(place[key]);
    }
  }

  if (Array.isArray(place.highlights)) {
    place.highlights = place.highlights
      .map((item) => (typeof item === "string" ? sanitizeReplacementText(item) : ""))
      .filter((item) => item.length > 0);
  }
}

function findUnresolvedPlaceIds(places) {
  const unresolved = [];
  for (const place of places) {
    if (!place || typeof place !== "object") {
      continue;
    }

    const textValues = [
      normalizeText(place.name, ""),
      normalizeText(place.title, ""),
      normalizeText(place.country, ""),
      normalizeText(place.region, ""),
      normalizeText(place.city, ""),
      normalizeText(place.description, ""),
      normalizeText(place.funFact, "")
    ];

    if (textValues.some((value) => hasReplacementChar(value))) {
      unresolved.push(normalizeText(place.id, "<unknown>"));
    }
  }

  return unresolved;
}

main();
