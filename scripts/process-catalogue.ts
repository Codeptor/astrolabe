#!/usr/bin/env tsx
/**
 * Downloads and processes the ATNF Pulsar Catalogue into pulsars.json.
 * Output: public/data/pulsars.json
 */

import { execFileSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const TARBALL_URL =
  "https://www.atnf.csiro.au/research/pulsar/psrcat/downloads/psrcat_pkg.tar.gz";
const CACHE_DIR = "/tmp/psrcat";
const TARBALL_PATH = join(CACHE_DIR, "psrcat_pkg.tar.gz");
const EXTRACT_DIR = join(CACHE_DIR, "psrcat_tar");
const DB_PATH = join(EXTRACT_DIR, "psrcat.db");
const OUT_DIR = join(process.cwd(), "public", "data");
const OUT_PATH = join(OUT_DIR, "pulsars.json");

// ---------------------------------------------------------------------------
// IAU J2000 galactic coordinate constants
// ---------------------------------------------------------------------------
const RA_NGP = (192.85948 * Math.PI) / 180; // right ascension of north galactic pole
const DEC_NGP = (27.12825 * Math.PI) / 180; // declination of north galactic pole
const L_NCP = (122.93192 * Math.PI) / 180; // galactic longitude of north celestial pole

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Convert equatorial (RA, Dec) in degrees → galactic (l, b) in degrees */
function equatorialToGalactic(raDeg: number, decDeg: number): { gl: number; gb: number } {
  const ra = toRad(raDeg);
  const dec = toRad(decDeg);

  const sinB =
    Math.sin(dec) * Math.sin(DEC_NGP) +
    Math.cos(dec) * Math.cos(DEC_NGP) * Math.cos(ra - RA_NGP);
  const b = Math.asin(sinB);

  const y = Math.cos(dec) * Math.sin(ra - RA_NGP);
  const x =
    Math.sin(dec) * Math.cos(DEC_NGP) -
    Math.cos(dec) * Math.sin(DEC_NGP) * Math.cos(ra - RA_NGP);
  const l = L_NCP - Math.atan2(y, x);

  let lDeg = toDeg(l);
  // Normalize to [0, 360)
  lDeg = ((lDeg % 360) + 360) % 360;

  return { gl: lDeg, gb: toDeg(b) };
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/** Parse "HH:MM:SS.sss" → degrees (multiply by 15) */
function parseRA(s: string): number {
  const parts = s.trim().split(":");
  const h = parseFloat(parts[0]);
  const m = parseFloat(parts[1] ?? "0");
  const sec = parseFloat(parts[2] ?? "0");
  return (h + m / 60 + sec / 3600) * 15;
}

/** Parse "[+-]DD:MM:SS.s" → degrees */
function parseDec(s: string): number {
  const str = s.trim();
  const sign = str.startsWith("-") ? -1 : 1;
  const abs = str.replace(/^[+-]/, "");
  const parts = abs.split(":");
  const d = parseFloat(parts[0]);
  const m = parseFloat(parts[1] ?? "0");
  const sec = parseFloat(parts[2] ?? "0");
  return sign * (d + m / 60 + sec / 3600);
}

// ---------------------------------------------------------------------------
// Download / cache logic
// ---------------------------------------------------------------------------

function ensureDatabase(): void {
  if (existsSync(DB_PATH)) {
    console.log(`Using cached DB: ${DB_PATH}`);
    return;
  }

  mkdirSync(CACHE_DIR, { recursive: true });
  mkdirSync(EXTRACT_DIR, { recursive: true });

  console.log("Downloading ATNF tarball…");
  execFileSync("curl", ["-sL", "-o", TARBALL_PATH, TARBALL_URL]);

  console.log("Extracting…");
  execFileSync("tar", ["xzf", TARBALL_PATH, "-C", EXTRACT_DIR, "--strip-components=1"]);

  if (!existsSync(DB_PATH)) {
    throw new Error(`psrcat.db not found after extraction at ${DB_PATH}`);
  }
}

// ---------------------------------------------------------------------------
// Database parser
// ---------------------------------------------------------------------------

interface RawRecord {
  PSRJ?: string;
  RAJ?: string;
  DECJ?: string;
  P0?: string;
  P1?: string;
  F0?: string;
  F1?: string;
  DIST_DM?: string;
  DIST1?: string;
  PX?: string;
}

function parseDatabase(text: string): RawRecord[] {
  const records: RawRecord[] = [];
  // Split on separator lines
  const blocks = text.split(/^@-+$/m);

  for (const block of blocks) {
    const record: RawRecord = {};
    for (const line of block.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      // KEY  VALUE  [uncertainty]  [reference]
      const match = trimmed.match(/^(\S+)\s+(\S+)/);
      if (!match) continue;
      const key = match[1];
      const value = match[2];

      switch (key) {
        case "PSRJ":
          record.PSRJ = value;
          break;
        case "RAJ":
          if (!record.RAJ) record.RAJ = value; // first occurrence wins
          break;
        case "DECJ":
          if (!record.DECJ) record.DECJ = value;
          break;
        case "P0":
          if (!record.P0) record.P0 = value;
          break;
        case "P1":
          if (!record.P1) record.P1 = value;
          break;
        case "F0":
          if (!record.F0) record.F0 = value;
          break;
        case "F1":
          if (!record.F1) record.F1 = value;
          break;
        case "DIST_DM":
          if (!record.DIST_DM) record.DIST_DM = value;
          break;
        case "DIST1":
          if (!record.DIST1) record.DIST1 = value;
          break;
        case "PX":
          if (!record.PX) record.PX = value;
          break;
      }
    }
    if (record.PSRJ) records.push(record);
  }

  return records;
}

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

interface PulsarEntry {
  name: string;
  gl: number;
  gb: number;
  dist: number;
  p0: number;
  p1: number | null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

ensureDatabase();

const raw = readFileSync(DB_PATH, "utf8");
const records = parseDatabase(raw);
console.log(`Parsed ${records.length} raw records`);

const pulsars: PulsarEntry[] = [];
let skipped = 0;

for (const r of records) {
  // Resolve period
  let p0: number | null = null;
  let p1: number | null = null;

  if (r.P0 !== undefined) {
    p0 = parseFloat(r.P0);
    p1 = r.P1 !== undefined ? parseFloat(r.P1) : null;
  } else if (r.F0 !== undefined) {
    const f0 = parseFloat(r.F0);
    if (f0 !== 0) {
      p0 = 1 / f0;
      if (r.F1 !== undefined) {
        const f1 = parseFloat(r.F1);
        p1 = -f1 / (f0 * f0);
      }
    }
  }

  // Resolve distance: prefer DIST1 (best estimate, may include parallax),
  // fall back to DIST_DM (DM-derived), then PX (raw parallax)
  let dist: number | null = null;
  if (r.DIST1 !== undefined) {
    const d = parseFloat(r.DIST1);
    if (!isNaN(d) && d > 0) dist = d;
  }
  if (dist === null && r.DIST_DM !== undefined) {
    const d = parseFloat(r.DIST_DM);
    if (!isNaN(d) && d > 0) dist = d;
  }
  if (dist === null && r.PX !== undefined) {
    const px = parseFloat(r.PX);
    if (!isNaN(px) && px > 0) dist = 1 / px; // parallax mas → distance kpc
  }

  // Filter: must have all required fields
  if (!r.PSRJ || !r.RAJ || !r.DECJ || p0 === null || isNaN(p0) || dist === null) {
    skipped++;
    continue;
  }

  const raDeg = parseRA(r.RAJ);
  const decDeg = parseDec(r.DECJ);
  const { gl, gb } = equatorialToGalactic(raDeg, decDeg);

  pulsars.push({
    name: r.PSRJ,
    gl: Math.round(gl * 100) / 100,
    gb: Math.round(gb * 100) / 100,
    dist,
    p0,
    p1: p1 !== null && !isNaN(p1) ? p1 : null,
  });
}

console.log(`Output: ${pulsars.length} pulsars (skipped ${skipped})`);

// Spot-check Crab Pulsar
const crab = pulsars.find((p) => p.name === "J0534+2200");
if (crab) {
  console.log(
    `Crab Pulsar: gl=${crab.gl} gb=${crab.gb} p0=${crab.p0.toFixed(6)} (expect gl≈184.56 gb≈-5.78 p0≈0.033410)`
  );
} else {
  console.warn("WARNING: Crab Pulsar J0534+2200 not found in output");
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(pulsars));
console.log(`Written to ${OUT_PATH}`);
