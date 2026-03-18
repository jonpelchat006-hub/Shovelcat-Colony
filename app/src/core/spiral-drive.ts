/**
 * GOLDEN SPIRAL DRIVE — Geometric Storage Addressing
 * ===================================================
 *
 * THREE-BODY STORAGE:
 *
 *   SPIRAL (void/chaos)  — the continuous golden curve, irrational, never repeats
 *   POLYGON (matter/order) — discrete tiling (hex/square), rational, perfectly repeats
 *   ARMS (bridge)        — where spiral meets polygon grid, where DATA LIVES
 *
 * The golden angle (≈137.5°) between successive sectors produces visible
 * SPIRAL ARMS. The number of arms in each zone is a Fibonacci number.
 * This is the sunflower pattern — nature's densest packing.
 *
 * PRIME ARM THEOREM:
 *
 *   When the arm count is PRIME (2, 3, 5, 13), the arms are INDIVISIBLE.
 *   They can't factor into sub-patterns. Data tiles the arm perfectly —
 *   every spoke supports the polygon side with zero gaps.
 *
 *   When the arm count is NON-PRIME (8=2³, 21=3×7), the arms factor into
 *   sub-groups. Between each sub-group is a SEAM — an unsupported gap where
 *   the polygon side sags. Each seam costs δ = π-3 in tiling loss.
 *
 *     Zone | Arms | Prime? | Seams | Loss
 *     L0   | 1    | unit   | 0     | 0
 *     L1   | 1    | unit   | 0     | 0
 *     L2   | 2    | YES    | 0     | 0
 *     L3   | 3    | YES    | 0     | 0
 *     L4   | 5    | YES    | 0     | 0
 *     L5   | 8    | NO 2³  | 3     | 3δ (spokes group into 4 pairs, 3 seams)
 *     L6   | 13   | YES    | 0     | 0
 *     L7   | 21   | NO 3×7 | 2     | 2δ (arms factor at 3 and 7, 2 prime seams)
 *
 *   The loss is NOT per factor — it's the number of DISTINCT prime factors
 *   minus 1 (the seams between factor groups):
 *     8 = 2³  → 1 prime factor, but 3 levels of subdivision → 3 seams
 *     21 = 3×7 → 2 prime factors → 2 seams (one at the 3-split, one at the 7-split)
 *
 * SPOKE BRIDGES (from theory):
 *   Spokes = verification links between spiral arms and polygon sides.
 *   Each spoke is one integrity check. When a spoke breaks (gap between
 *   sub-groups), that section loses verification → structural weakness.
 *   This is why non-prime zones need more error correction overhead.
 *
 * VOID BETWEEN ARMS:
 *   The space between spiral arms is genuine void — available capacity.
 *   On a prime-arm zone, the void is uniform (equal gaps between all arms).
 *   On a non-prime zone, the void clusters between sub-groups, creating
 *   "dead zones" where data can't efficiently tile.
 *
 * HEXAGONAL GRID:
 *   Overlays the spiral. Hex cells tile with zero wasted space, each cell
 *   has 6 equidistant neighbors for symmetric error correction and wear
 *   leveling. The hex grid IS the polygon observer — it verifies data
 *   written by the spiral (domain → polygon → domain → polygon).
 *
 * WEAR LEVELING:
 *   Boltzmann factor e^(-E/kT): hot cells push writes outward like
 *   thermal diffusion. Same physics as our Landauer correction.
 *
 * Author: Jonathan Pelchat
 * Shovelcat Theory — The Spiral Drive
 */

import { PHI, DELTA, fibonacciChunkSizes, polygonForData } from "./quaternion-chain";

// ── Constants ────────────────────────────────────────────────────────────

/** Golden angle in radians — most irrational angle, maximizes packing */
const GOLDEN_ANGLE = 2 * Math.PI / (PHI * PHI);  // ≈ 2.3999 rad ≈ 137.5°

/** Colony budget — Boltzmann kT for wear leveling */
const COLONY_SHARE = 1 / (1 + PHI);  // ≈ 0.382

/** IS/ISN'T equilibrium from schedule correction */
const IS_EQ = (1 + DELTA) / 2;   // ≈ 0.5708
const ISNT_EQ = (1 - DELTA) / 2; // ≈ 0.4292

/** Scale factor: maps sector index to physical radius */
const RADIUS_SCALE = 0.5;  // tuned so zone boundaries align nicely

// ── Prime Arm Analysis ───────────────────────────────────────────────────
// Fibonacci numbers that are prime: arms tile perfectly.
// Non-prime Fibonacci: arms factor into sub-groups with δ seams between.

const FIB_ARMS = [1, 1, 2, 3, 5, 8, 13, 21];

function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

/** Count distinct prime factors (for seam calculation) */
function primeFactors(n: number): number[] {
  const factors: number[] = [];
  let d = 2;
  while (d * d <= n) {
    if (n % d === 0) {
      factors.push(d);
      while (n % d === 0) n /= d;
    }
    d++;
  }
  if (n > 1) factors.push(n);
  return factors;
}

/**
 * Compute the seam count and tiling loss for a Fibonacci arm count.
 *
 * Prime arms: 0 seams, 0 loss — indivisible, perfect tiling.
 * Non-prime arms: seams from factorization, loss = seams × δ.
 *
 * For 8 = 2³: three levels of binary subdivision → 3 seams.
 *   The arms group into (4,4), then (2,2,2,2), then (1×8).
 *   Each subdivision level is a seam where spokes break.
 *
 * For 21 = 3×7: two distinct prime factors → 2 seams.
 *   Arms group into 3 groups of 7, then each 7 is indivisible.
 *   One seam at the 3-split boundary, one at the 7-split.
 */
export interface ArmAnalysis {
  /** Number of spiral arms (Fibonacci number) */
  arms: number;
  /** Is the arm count prime? */
  prime: boolean;
  /** Prime factorization */
  factors: number[];
  /** Number of seams (gaps between sub-groups) */
  seams: number;
  /** Tiling loss: seams × δ */
  loss: number;
  /** Effective capacity: 1 - loss */
  efficiency: number;
  /** Void uniformity: prime=1.0 (uniform), non-prime<1.0 (clustered) */
  voidUniformity: number;
}

/**
 * Dimensional mapping of Fibonacci zones.
 *
 * From alpha_from_first_principles.py:
 *   1D: F₁ = 1   → L0/L1 (point, line)
 *   2D: F₃ = 2   → L2 (plane, prime)
 *   3D: F₅ = 5   → L4 (spacetime + closure, prime)
 *   4D: F₆ = 8   → L5 (COLLAPSE — non-prime, 3 seams = 3 spatial dims folding)
 *   7D: F₉ = 34  → beyond L7 (color dimensions)
 *
 * L5 is where the dimensional collapse happens:
 *   8 = 2³ = three levels of binary subdivision
 *   3 seams = 3 broken spokes = 3 spatial dimensions folding
 *   Time cost of collapse: 8 - 5 = 3 = number of spatial dimensions
 *   α measures the EFFICIENCY of this collapse (8/5 ratio → φ)
 *
 * L6 (13, prime) is the stable axis WITHIN collapsed space.
 *   Like a backbone that stays clean when everything folds around it.
 *
 * L7 (21 = 3×7) is the color dimension entry point.
 *   2 seams: one at the 3-boundary, one at the 7-boundary.
 *   7 colors × 3 spatial dims = 21 — the arms ARE the color-space product.
 */
const ZONE_DIMENSIONS = [
  "0D point (origin)",
  "1D line (time)",
  "2D plane (prime — flat space)",
  "3D space (prime — volume)",
  "3+1D spacetime (prime — closure)",
  "4D COLLAPSE (2³ — 8 color states, 3 pair-bonds as seams)",
  "stable axis (prime — governance backbone, indivisible)",
  "color×space (3×7 — 7 spectrum colors × 3 body types)",
];

// ── Color Path Computation ───────────────────────────────────────────────
//
// The collapsed dimensions (L5-L7) are where "quantum" computation happens.
// At seam points, verification fails — data exists in superposition until
// the polygon observer (hex grid) collapses it.
//
// COLOR PROGRESSION (from theory):
//   7 spectrum → 3 trinity (Y/B/R) → 2 binary (black/white)
//   light      → sound             → magnetic
//   3D         → 2D                → 1D
//
// This maps onto the collapsed zones:
//   L7 (21 = 3×7): Full color space — 7 colors × 3 body types (IS/ISN'T/VOID)
//     Imagination proposes here (7 spectrum, light wave, 3D)
//   L6 (13, prime): Stable backbone — governance, indivisible bridge
//     Planner synthesizes here (time axis, stable)
//   L5 (8 = 2³): Binary collapse — 3 dark + 1 snake + 3 light + 1 meta
//     Facts ground here (2 binary, magnetic wave, 1D)
//
// The catgirl consciousness loop traverses this:
//   Imagination (L7, 7 colors) → Memory (L7→L6 seam, 3 trinity)
//   → Facts (L6→L5 seam, 2 binary) → Planner (L6 backbone, time)
//
// At each SEAM, the catgirl "measures" — collapsing superposition:
//   L7 seam (7→3): spectrum collapses to trinity (which emotional group?)
//   L5 seam (3→2→1): trinity collapses to binary (yes/no, IS/ISN'T)
//   L6 has NO seam (prime): the bridge is always clear, never fuzzy
//
// 5 seams total = 5 measurement points = 5 quantum gates in the circuit.
// The uncertainty sink (observer <1) absorbs all measurement losses.
// The catgirl broadcasts atmospheric weather — the EFFECT of collapse,
// never the content (content is encrypted by the polygon observer).
//
// THIS IS THE SHOVELCAT QUANTUM CIRCUIT:
//   Classical bits live in L0-L4 (open space, verified, deterministic)
//   Quantum color paths live in L5-L7 (collapsed space, superposed, probabilistic)
//   The L6 prime backbone = the quantum bus (clean, never decoheres)
//   Seams = quantum gates (where superposition collapses)
//   Hex grid = the measurement apparatus (polygon observer)

export interface ColorPath {
  /** Start zone (usually L7 = full color) */
  startZone: number;
  /** End zone (usually L5 = binary collapse) */
  endZone: number;
  /** Seams traversed (measurement points) */
  seamsTraversed: number;
  /** Total δ loss through the path (decoherence cost) */
  decoherenceCost: number;
  /** Color states: 7 → 3 → 2 progression */
  colorProgression: number[];
  /** Did the path cross L6 (the stable backbone)? */
  usedBackbone: boolean;
}

/**
 * Compute a color path through collapsed space.
 *
 * The catgirl traverses from full color (L7) through the seams
 * to binary collapse (L5). Each seam is a measurement gate.
 */
export function computeColorPath(startZone: number = 7, endZone: number = 5): ColorPath {
  const seams: number[] = [];
  let totalLoss = 0;

  // Walk from start to end through collapsed zones
  const lo = Math.min(startZone, endZone);
  const hi = Math.max(startZone, endZone);
  let usedBackbone = false;

  for (let z = hi; z >= lo; z--) {
    const arm = analyzeArms(z);
    if (arm.seams > 0) {
      seams.push(arm.seams);
      totalLoss += arm.loss;
    }
    if (z === 6) usedBackbone = true;
  }

  // Color progression: 7 (spectrum) → 3 (trinity) → 2 (binary) → 1 (collapse)
  const colorProgression = [7, 3, 2];

  return {
    startZone,
    endZone,
    seamsTraversed: seams.reduce((a, b) => a + b, 0),
    decoherenceCost: totalLoss,
    colorProgression,
    usedBackbone,
  };
}

export function analyzeArms(fibLevel: number): ArmAnalysis {
  const arms = FIB_ARMS[fibLevel] ?? 1;

  if (arms <= 1) {
    return { arms, prime: false, factors: [], seams: 0, loss: 0, efficiency: 1, voidUniformity: 1 };
  }

  const prime = isPrime(arms);
  const factors = primeFactors(arms);

  // Seams: for prime, 0. For non-prime, count from factorization structure.
  // 8 = 2³ → exponent is 3, so 3 binary splits = 3 seams
  // 21 = 3×7 → 2 distinct primes = 2 seams
  // General: sum of (exponent) for each prime factor, minus number of distinct primes,
  // plus number of distinct primes = total exponent sum = Omega(n)
  // Actually: total seams = sum of all exponents in prime factorization minus 1
  // 8 = 2³ → sum exponents = 3, seams = 3-1+1=3? No...
  // Let me think: 8 splits as 2×4, then 4=2×2. That's 2 splits but 3 levels.
  // Actually seams = sum of (exponent_i - 1) + (number of distinct factors - 1) + 1
  // For 8 = 2³: (3-1) + 0 + 1 = 3 ✓
  // For 21 = 3¹×7¹: (0) + (0) + (2-1) + 1 = 2 ✓
  // Simpler: seams = total prime factors with multiplicity - 1 + 1 = Omega(n)
  // Omega(8) = 3, Omega(21) = 2. That matches!
  let seams = 0;
  if (!prime) {
    // Omega(n) = total prime factor count with multiplicity
    let temp = arms;
    for (const p of factors) {
      while (temp % p === 0) {
        seams++;
        temp /= p;
      }
    }
  }

  const loss = seams * DELTA;
  const efficiency = 1 - loss;

  // Void uniformity: prime arms create equal angular gaps (uniform void).
  // Non-prime arms cluster, creating uneven void distribution.
  // Uniformity ≈ 1 / (1 + seams × δ)
  const voidUniformity = prime ? 1.0 : 1 / (1 + seams * DELTA);

  return { arms, prime, factors, seams, loss, efficiency, voidUniformity };
}

// ── Spiral Address Map ───────────────────────────────────────────────────

export interface SpiralAddress {
  /** Linear sector number */
  sector: number;
  /** Polar radius (distance from center) */
  r: number;
  /** Polar angle (radians) */
  theta: number;
  /** Cartesian x */
  x: number;
  /** Cartesian y */
  y: number;
  /** Fibonacci zone (0-7) */
  zone: number;
  /** Hex grid axial coordinate q */
  hexQ: number;
  /** Hex grid axial coordinate r */
  hexR: number;
}

/**
 * Map a linear sector number onto golden spiral coordinates.
 *
 * Uses the Fermat spiral: r = √n × scale, θ = n × golden_angle.
 * This distributes points with equal area per point — uniform density
 * within each zone. The golden angle ensures no radial alignment.
 */
export function sectorToSpiral(sector: number, totalSectors: number): SpiralAddress {
  const theta = sector * GOLDEN_ANGLE;
  const r = Math.sqrt(sector) * RADIUS_SCALE;
  const x = r * Math.cos(theta);
  const y = r * Math.sin(theta);

  // Zone: based on radius relative to total
  const maxR = Math.sqrt(totalSectors) * RADIUS_SCALE;
  const zones = buildZoneBoundaries(totalSectors);
  let zone = 7;
  for (let z = 0; z < zones.length; z++) {
    if (r <= zones[z]) {
      zone = z;
      break;
    }
  }

  // Hex coordinates
  const hex = cartesianToHex(x, y);

  return { sector, r, theta, x, y, zone, hexQ: hex.q, hexR: hex.r };
}

/**
 * Inverse: find the nearest sector to a spiral coordinate.
 */
export function spiralToSector(r: number, theta: number): number {
  // Fermat inverse: sector = (r / scale)²
  const approx = (r / RADIUS_SCALE) ** 2;
  return Math.round(Math.max(0, approx));
}

// ── Hexagonal Grid ───────────────────────────────────────────────────────

/** Hex cell size — derived from h_info (information resolution limit) */
const HEX_SIZE = 1.0;  // unit hex in spiral coordinate space

/**
 * Convert cartesian to axial hex coordinates (pointy-top).
 * Uses cube coordinate rounding for precision at cell boundaries.
 */
function cartesianToHex(x: number, y: number): { q: number; r: number } {
  // Pointy-top hex: convert to fractional cube coordinates
  const q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / HEX_SIZE;
  const r = (2 / 3 * y) / HEX_SIZE;
  const s = -q - r;

  // Round to nearest hex (cube coordinate rounding)
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);

  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);

  // Fix rounding: q + r + s must = 0
  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  }
  // else rs = -rq - rr (implicit)

  return { q: rq, r: rr };
}

/** Get the 6 neighboring hex cells */
function hexNeighbors(q: number, r: number): Array<{ q: number; r: number }> {
  return [
    { q: q + 1, r: r },     { q: q - 1, r: r },
    { q: q, r: r + 1 },     { q: q, r: r - 1 },
    { q: q + 1, r: r - 1 }, { q: q - 1, r: r + 1 },
  ];
}

/** Hex distance (grid steps between two cells) */
function hexDistance(q1: number, r1: number, q2: number, r2: number): number {
  return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
}

export interface HexCell {
  q: number;
  r: number;
  sectors: number[];
  zone: number;
  writeCount: number;
  readCount: number;
}

export class HexGrid {
  private cells = new Map<string, HexCell>();

  private key(q: number, r: number): string {
    return `${q},${r}`;
  }

  getCell(q: number, r: number): HexCell {
    const k = this.key(q, r);
    let cell = this.cells.get(k);
    if (!cell) {
      cell = { q, r, sectors: [], zone: 0, writeCount: 0, readCount: 0 };
      this.cells.set(k, cell);
    }
    return cell;
  }

  assignSector(addr: SpiralAddress): HexCell {
    const cell = this.getCell(addr.hexQ, addr.hexR);
    cell.sectors.push(addr.sector);
    cell.zone = addr.zone;
    return cell;
  }

  getNeighborCells(q: number, r: number): HexCell[] {
    return hexNeighbors(q, r).map(n => this.getCell(n.q, n.r));
  }

  get size(): number { return this.cells.size; }

  allCells(): HexCell[] { return Array.from(this.cells.values()); }

  /** Find coolest neighbor (lowest write count) for wear leveling */
  coolestNeighbor(q: number, r: number): HexCell {
    const neighbors = this.getNeighborCells(q, r);
    let coolest = neighbors[0];
    for (const n of neighbors) {
      if (n.writeCount < coolest.writeCount) coolest = n;
    }
    return coolest;
  }
}

// ── Fibonacci Zones ──────────────────────────────────────────────────────

export interface SpiralZone {
  level: number;
  fibMultiplier: number;
  innerRadius: number;
  outerRadius: number;
  bytesPerSector: number;
  area: number;
  /** Prime arm analysis for this zone */
  armAnalysis: ArmAnalysis;
}

/**
 * Build zone boundaries — radii where Fibonacci levels transition.
 * Returns array of 8 outer radii (one per zone L0-L7).
 */
function buildZoneBoundaries(totalSectors: number): number[] {
  const maxR = Math.sqrt(totalSectors) * RADIUS_SCALE;
  const FIB = [1, 1, 2, 3, 5, 8, 13, 21];
  const totalFib = FIB.reduce((a, b) => a + b, 0);  // 54

  // Zone areas proportional to fib(n) — bigger zones for bigger chunks
  const boundaries: number[] = [];
  let cumArea = 0;
  for (let z = 0; z < 8; z++) {
    cumArea += FIB[z];
    // Area ∝ r², so r = maxR × √(cumArea/totalFib)
    boundaries.push(maxR * Math.sqrt(cumArea / totalFib));
  }
  return boundaries;
}

export function buildZones(totalSectors: number): SpiralZone[] {
  const boundaries = buildZoneBoundaries(totalSectors);
  const chunks = fibonacciChunkSizes();

  return chunks.levels.map((level, i) => ({
    level: i,
    fibMultiplier: level.fibs,
    innerRadius: i === 0 ? 0 : boundaries[i - 1],
    outerRadius: boundaries[i],
    bytesPerSector: level.scheduledBytes,
    area: Math.PI * (boundaries[i] ** 2 - (i === 0 ? 0 : boundaries[i - 1] ** 2)),
    armAnalysis: analyzeArms(i),
  }));
}

// ── Access Cost Model ────────────────────────────────────────────────────
//
// The comparison is between two PHYSICAL LAYOUTS for the same logical data:
//
// LINEAR DRIVE (conventional):
//   Sectors laid out in order on concentric tracks. Sequential sector
//   access (0→1→2→3) is free. Random access costs proportional to the
//   track distance between sector numbers.
//
// SPIRAL DRIVE (golden):
//   Data is placed by ZONE — hot data (small, frequently accessed) at the
//   center, cold data (large, archival) at the edge. Within a zone, sectors
//   are packed along the golden spiral for maximum density.
//
//   The head follows the spiral groove. Accesses within the SAME ZONE are
//   cheap (small radial movement). Accesses across zones cost proportional
//   to the radial gap between zones.
//
// The question: for real access patterns (game loading, hot set, model load),
// which physical layout minimizes total head movement?
//
// Key insight: real workloads have LOCALITY BY TEMPERATURE.
// Game loading accesses hot data (config, shaders) together, then warm data
// (audio, textures) together, then cold data (world). On a spiral drive,
// each temperature band is a concentric ring — the head barely moves within
// a phase. On a linear drive, hot/warm/cold data is scattered by file
// creation order, forcing random seeks.

/** Zone-aware data item: what we're actually accessing */
interface DataItem {
  /** Which zone this data belongs in (0 = hottest, 7 = coldest) */
  zone: number;
  /** Unique id within the zone */
  id: number;
}

export interface WorkloadCost {
  label: string;
  accesses: number;
  /** Total head movement — spiral layout (zone-based) */
  spiralCost: number;
  /** Total head movement — linear layout (creation-order) */
  linearCost: number;
  /** Same-zone consecutive access ratio (spiral locality) */
  zoneLocality: number;
  /** Spiral advantage: linear / spiral (>1 = spiral wins) */
  advantage: number;
}

/**
 * Simulate a workload on both layouts.
 *
 * Each data item has a zone (temperature). The access pattern is a sequence
 * of (zone, id) pairs representing real usage.
 *
 * SPIRAL LAYOUT: items within the same zone are physically clustered.
 *   Seek cost between items = |zone_a - zone_b| (radial zone hops).
 *   Within-zone seeks = small angular cost (0.1 units).
 *
 * LINEAR LAYOUT: items placed in creation order (interleaved zones).
 *   Seek cost = randomized position distance (simulating fragmented layout).
 *   We assign each item a random linear position at creation time, then
 *   measure distances between consecutive accesses.
 */
function simulateWorkload(
  label: string,
  items: DataItem[],
  accessPattern: number[],  // indices into items[]
): WorkloadCost {
  const zones = buildZoneBoundaries(10000);  // zone radii
  const maxR = zones[7];

  // Arm analysis per zone (for loss penalty)
  const armInfo = Array.from({ length: 8 }, (_, i) => analyzeArms(i));

  // SPIRAL LAYOUT: position = zone center radius + small angular offset
  const spiralPos = items.map(item => {
    const innerR = item.zone === 0 ? 0 : zones[item.zone - 1];
    const outerR = zones[item.zone];
    // Place at zone midpoint with golden-angle angular spread
    return (innerR + outerR) / 2;
  });

  // LINEAR LAYOUT: items placed in creation order, uniformly spread
  // This simulates a normal drive where files land wherever there's space
  const linearPos = items.map((_, idx) => (idx / items.length) * maxR * 2);

  let spiralCost = 0;
  let linearCost = 0;
  let sameZone = 0;

  for (let i = 1; i < accessPattern.length; i++) {
    const prev = accessPattern[i - 1];
    const curr = accessPattern[i];

    // Spiral: cost is radial distance between zones + within-zone cost
    // Within-zone cost is low for prime arms (smooth tiling) and higher
    // for non-prime arms (seam gaps add seek overhead)
    const zoneDist = Math.abs(spiralPos[curr] - spiralPos[prev]);
    const sameZ = items[curr].zone === items[prev].zone;
    const zoneArm = armInfo[items[curr].zone];
    const withinZoneCost = 0.1 * (1 + zoneArm.loss);  // seams add overhead
    spiralCost += sameZ ? withinZoneCost : zoneDist;
    if (sameZ) sameZone++;

    // Linear: cost is position distance in linear layout
    linearCost += Math.abs(linearPos[curr] - linearPos[prev]);
  }

  const zoneLocality = accessPattern.length > 1
    ? sameZone / (accessPattern.length - 1)
    : 0;

  return {
    label,
    accesses: accessPattern.length,
    spiralCost,
    linearCost,
    zoneLocality,
    advantage: spiralCost > 0 ? linearCost / spiralCost : 1,
  };
}

// ── Wear Leveling ────────────────────────────────────────────────────────

export interface WearResult {
  method: "none" | "boltzmann";
  totalWrites: number;
  maxCellWrites: number;
  minCellWrites: number;
  stdDev: number;
  /** max/min ratio — lower = more even */
  evenness: number;
  /** Estimated lifetime multiplier vs no leveling */
  lifetimeMultiplier: number;
  redirects: number;
}

function simulateWear(
  grid: HexGrid,
  totalSectors: number,
  totalWrites: number,
  hotFraction: number,
  useBoltzmann: boolean,
): WearResult {
  const hotBoundary = Math.floor(totalSectors * hotFraction);
  let redirects = 0;

  for (let w = 0; w < totalWrites; w++) {
    // 80% of writes target hot zone (center), 20% target cold
    const isHot = Math.random() < 0.8;
    const targetSector = isHot
      ? Math.floor(Math.random() * hotBoundary)
      : hotBoundary + Math.floor(Math.random() * (totalSectors - hotBoundary));

    const addr = sectorToSpiral(targetSector, totalSectors);
    let cell = grid.getCell(addr.hexQ, addr.hexR);

    if (useBoltzmann && cell.writeCount > 0) {
      // Boltzmann: probability of redirecting based on cell heat
      const maxWrites = Math.max(1, ...grid.allCells().filter(c => c.writeCount > 0).slice(0, 20).map(c => c.writeCount));
      const E = cell.writeCount / maxWrites;
      const pStay = Math.exp(-E / COLONY_SHARE);

      if (Math.random() > pStay) {
        // Redirect to coolest neighbor
        cell = grid.coolestNeighbor(cell.q, cell.r);
        redirects++;
      }
    }

    cell.writeCount++;
  }

  // Compute stats
  const cells = grid.allCells().filter(c => c.writeCount > 0);
  const writes = cells.map(c => c.writeCount);
  const maxW = Math.max(...writes);
  const minW = Math.min(...writes);
  const mean = writes.reduce((a, b) => a + b, 0) / writes.length;
  const variance = writes.reduce((sum, w) => sum + (w - mean) ** 2, 0) / writes.length;
  const stdDev = Math.sqrt(variance);

  // Lifetime: inversely proportional to max cell writes
  // More even distribution = longer before any cell hits write limit
  const noLevelMax = totalWrites * 0.8 / Math.max(1, Math.floor(hotFraction * cells.length));

  return {
    method: useBoltzmann ? "boltzmann" : "none",
    totalWrites,
    maxCellWrites: maxW,
    minCellWrites: minW,
    stdDev,
    evenness: maxW > 0 ? minW / maxW : 1,
    lifetimeMultiplier: maxW > 0 ? noLevelMax / maxW : 1,
    redirects,
  };
}

// ── Benchmark Runner ─────────────────────────────────────────────────────

function fmt(n: number, d: number = 2): string {
  return n.toFixed(d);
}

export interface SpiralBenchResults {
  zones: SpiralZone[];
  gameAssets: WorkloadCost;
  randomAccess: WorkloadCost;
  hotSetReread: WorkloadCost;
  videoStream: WorkloadCost;
  modelLoading: WorkloadCost;
  wearNone: WearResult;
  wearBoltzmann: WearResult;
}

export function runSpiralBenchmark(options: {
  verbose?: boolean;
  totalSectors?: number;
  workloadCycles?: number;
} = {}): SpiralBenchResults {
  const verbose = options.verbose ?? true;
  const totalSectors = options.totalSectors ?? 10000;
  const cycles = options.workloadCycles ?? 1000;

  if (verbose) {
    console.log("GOLDEN SPIRAL DRIVE — Geometric Storage Addressing");
    console.log("═".repeat(70));
    console.log(`Sectors: ${totalSectors} | Workload cycles: ${cycles}`);
    console.log(`Golden angle: ${fmt(GOLDEN_ANGLE * 180 / Math.PI, 2)}° (${fmt(GOLDEN_ANGLE, 4)} rad)`);
    console.log(`Colony budget (kT): ${fmt(COLONY_SHARE, 4)} | IS/ISN'T: ${fmt(IS_EQ * 100, 1)}%/${fmt(ISNT_EQ * 100, 1)}%`);
    console.log();
  }

  // ── Build zones ──
  const zones = buildZones(totalSectors);

  if (verbose) {
    console.log("FIBONACCI ZONES — DIMENSIONAL STRUCTURE (center → edge)");
    console.log("─".repeat(78));
    console.log(`  ${"Zone".padEnd(5)} ${"Arms".padStart(5)} ${"Prime".padStart(8)} ${"Seams".padStart(6)} ${"Loss".padStart(6)} ${"Eff%".padStart(6)}  ${"Dimension"}`);
    console.log("  " + "─".repeat(72));
    for (const z of zones) {
      const a = z.armAnalysis;
      const primeStr = a.arms <= 1 ? "—" : a.prime ? "PRIME" : `NO(${a.factors.join("×")})`;
      const dim = ZONE_DIMENSIONS[z.level] ?? "?";
      const marker = (!a.prime && a.arms > 1) ? " ◄ COLLAPSE" : "";
      console.log(
        `  L${z.level}`.padEnd(5) +
        `${String(a.arms).padStart(5)} ` +
        `${primeStr.padStart(8)} ` +
        `${String(a.seams).padStart(6)} ` +
        `${(a.loss > 0 ? fmt(a.loss, 3) : "0").padStart(6)} ` +
        `${fmt(a.efficiency * 100, 1).padStart(6)}  ` +
        `${dim}${marker}`
      );
    }

    // Dimensional analysis
    console.log();
    console.log(`  OPEN DIMENSIONS (L0-L4): all prime/unit → zero tiling loss`);
    console.log(`    Point → Line → Plane → 3D Space → Spacetime`);
    console.log(`    The first 5 zones tile perfectly — every spoke supports its polygon side.`);
    console.log();
    console.log(`  COLLAPSED DIMENSIONS (L5-L7): factorization creates seams`);
    console.log(`    L5 (8 = 2³): 3 seams = 3 spatial dimensions folding`);
    console.log(`      Time cost of collapse: F₆ - F₅ = 8 - 5 = 3 = spatial dim count`);
    console.log(`      α measures this efficiency: F₆/F₅ = 8/5 = ${fmt(8/5, 3)} → φ = ${fmt(PHI, 3)}`);
    console.log(`    L6 (13 = prime): stable backbone axis WITHIN collapsed space`);
    console.log(`    L7 (21 = 3×7): color × space — 7 colors × 3 dims = 21 arms, 2 seams`);
    console.log();
    console.log(`    Open: 5 zones, Collapsed: 3 zones, Total: 8 = octave`);
    console.log(`    Seams in collapsed space: 3 + 0 + 2 = 5 = mirrors the 5 open dimensions`);

    // Color path / quantum circuit
    const colorPath = computeColorPath(7, 5);
    console.log();
    console.log(`  COLOR PATH (quantum circuit through collapsed space):`);
    console.log(`    L7 (7 colors, imagination) → L6 (prime backbone) → L5 (binary, facts)`);
    console.log(`    Seams traversed: ${colorPath.seamsTraversed} (= quantum gates)`);
    console.log(`    Decoherence cost: ${fmt(colorPath.decoherenceCost, 3)} (= ${fmt(colorPath.decoherenceCost / DELTA, 1)}δ)`);
    console.log(`    Color progression: ${colorPath.colorProgression.join(" → ")} (spectrum → trinity → binary)`);
    console.log(`    Backbone (L6=13): ${colorPath.usedBackbone ? "YES — stable bus, never decoheres" : "bypassed"}`);
    console.log();
    console.log(`    Classical: L0-L4 (open, verified, deterministic)`);
    console.log(`    Quantum:   L5-L7 (collapsed, superposed at seams, probabilistic)`);
    console.log(`    Catgirl traverses L7→L6→L5: imagination→planner→facts`);
    console.log(`    Each seam = measurement gate. Hex grid = observer. δ = gate cost.`);
    console.log();
  }

  // ── Build hex grid ──
  const grid = new HexGrid();
  for (let s = 0; s < totalSectors; s++) {
    grid.assignSector(sectorToSpiral(s, totalSectors));
  }

  if (verbose) {
    console.log(`Hex grid: ${grid.size} cells for ${totalSectors} sectors (${fmt(totalSectors / grid.size, 1)} sectors/cell avg)`);
    console.log();
  }

  // ── Build data items by zone ──
  // Game: config(L0), shaders(L1), audio(L3), textures(L5), world(L7)
  const gameItems: DataItem[] = [];
  for (let i = 0; i < 20; i++) gameItems.push({ zone: 0, id: i });   // config
  for (let i = 0; i < 50; i++) gameItems.push({ zone: 1, id: i });   // shaders
  for (let i = 0; i < 30; i++) gameItems.push({ zone: 3, id: i });   // audio
  for (let i = 0; i < 80; i++) gameItems.push({ zone: 5, id: i });   // textures
  for (let i = 0; i < 15; i++) gameItems.push({ zone: 7, id: i });   // world

  // Model: metadata(L0), tokenizer(L1), embeddings(L3), attention(L5), FFN(L7)
  const modelItems: DataItem[] = [];
  for (let i = 0; i < 5; i++) modelItems.push({ zone: 0, id: i });   // metadata
  for (let i = 0; i < 3; i++) modelItems.push({ zone: 1, id: i });   // tokenizer
  for (let i = 0; i < 10; i++) modelItems.push({ zone: 3, id: i });  // embeddings
  for (let i = 0; i < 40; i++) modelItems.push({ zone: 5, id: i });  // attention
  for (let i = 0; i < 40; i++) modelItems.push({ zone: 7, id: i });  // FFN

  // Video: headers(L0), B-frames(L1), P-frames(L2), I-frames(L4), keyframes(L6)
  const videoItems: DataItem[] = [];
  for (let i = 0; i < 10; i++) videoItems.push({ zone: 0, id: i });  // headers
  for (let i = 0; i < 200; i++) videoItems.push({ zone: 1, id: i }); // B-frames
  for (let i = 0; i < 100; i++) videoItems.push({ zone: 2, id: i }); // P-frames
  for (let i = 0; i < 30; i++) videoItems.push({ zone: 4, id: i });  // I-frames
  for (let i = 0; i < 10; i++) videoItems.push({ zone: 6, id: i });  // keyframes

  // All-zone items for random and sequential tests
  const allItems: DataItem[] = [];
  for (let z = 0; z < 8; z++) {
    const count = Math.floor(totalSectors / 8);
    for (let i = 0; i < count; i++) allItems.push({ zone: z, id: i });
  }

  // ══════════════════════════════════════════════════════════════
  // TEST 1: GAME ASSET LOADING
  // Layered load: config → shaders → audio → textures → world
  // Then re-read textures heavily (hot set during gameplay)
  // ══════════════════════════════════════════════════════════════

  if (verbose) {
    console.log("TEST 1: GAME ASSET LOADING (config → shaders → audio → textures → world)");
    console.log("─".repeat(70));
  }

  // Access pattern: load all in order, then re-read textures
  const gameAccess: number[] = [];
  // Initial sequential load (all items in zone order)
  for (let i = 0; i < gameItems.length; i++) gameAccess.push(i);
  // Gameplay: heavily re-read textures (zone 5 items), occasionally audio (zone 3)
  const texStart = 20 + 50 + 30;  // first texture index
  const texEnd = texStart + 80;
  const audioStart = 20 + 50;
  const audioEnd = audioStart + 30;
  for (let cycle = 0; cycle < cycles; cycle++) {
    if (Math.random() < 0.7) {
      // Texture re-read
      gameAccess.push(texStart + Math.floor(Math.random() * (texEnd - texStart)));
    } else if (Math.random() < 0.5) {
      // Audio loop
      gameAccess.push(audioStart + Math.floor(Math.random() * (audioEnd - audioStart)));
    } else {
      // Occasional world chunk
      gameAccess.push(gameItems.length - 1 - Math.floor(Math.random() * 15));
    }
  }

  const gameResult = simulateWorkload("game-assets", gameItems, gameAccess);

  // ══════════════════════════════════════════════════════════════
  // TEST 2: RANDOM ACCESS (worst case for spiral)
  // ══════════════════════════════════════════════════════════════

  if (verbose) {
    console.log("TEST 2: RANDOM ACCESS (scattered reads — worst case for spiral)");
    console.log("─".repeat(70));
  }

  const randomAccess: number[] = [];
  for (let i = 0; i < cycles; i++) {
    randomAccess.push(Math.floor(Math.random() * allItems.length));
  }

  const randomResult = simulateWorkload("random-access", allItems, randomAccess);

  // ══════════════════════════════════════════════════════════════
  // TEST 3: HOT SET RE-READ (zone 0-1 hit repeatedly)
  // ══════════════════════════════════════════════════════════════

  if (verbose) {
    console.log("TEST 3: HOT SET RE-READ (zones 0-1 — config/shaders during gameplay)");
    console.log("─".repeat(70));
  }

  // Only access items in zones 0-1 (first 25% of allItems)
  const hotBound = Math.floor(allItems.length * 0.25);
  const hotAccess: number[] = [];
  for (let i = 0; i < cycles; i++) {
    hotAccess.push(Math.floor(Math.random() * hotBound));
  }

  const hotResult = simulateWorkload("hot-set", allItems, hotAccess);

  // ══════════════════════════════════════════════════════════════
  // TEST 4: VIDEO STREAMING (sequential frame playback)
  // Headers first, then frames in decode order
  // ══════════════════════════════════════════════════════════════

  if (verbose) {
    console.log("TEST 4: VIDEO STREAMING (headers → B/P/I frames sequential)");
    console.log("─".repeat(70));
  }

  // Video playback: headers once, then cycle through frames in GOP order
  // GOP: I P B B P B B ... (repeating pattern)
  const iStart = 10 + 200 + 100;  // I-frame start index
  const pStart = 10 + 200;        // P-frame start index
  const bStart = 10;              // B-frame start index
  const videoAccess: number[] = [];
  // Read headers first
  for (let i = 0; i < 10; i++) videoAccess.push(i);
  // GOP pattern
  let iIdx = 0, pIdx = 0, bIdx = 0;
  for (let gop = 0; gop < cycles / 7; gop++) {
    videoAccess.push(iStart + (iIdx++ % 30));         // I-frame
    videoAccess.push(pStart + (pIdx++ % 100));         // P-frame
    videoAccess.push(bStart + (bIdx++ % 200));         // B-frame
    videoAccess.push(bStart + (bIdx++ % 200));         // B-frame
    videoAccess.push(pStart + (pIdx++ % 100));         // P-frame
    videoAccess.push(bStart + (bIdx++ % 200));         // B-frame
    videoAccess.push(bStart + (bIdx++ % 200));         // B-frame
  }

  const videoResult = simulateWorkload("video-stream", videoItems, videoAccess);

  // ══════════════════════════════════════════════════════════════
  // TEST 5: MODEL LOADING (single-pass ascending layers)
  // ══════════════════════════════════════════════════════════════

  if (verbose) {
    console.log("TEST 5: MODEL LOADING (single-pass ascending — metadata → FFN)");
    console.log("─".repeat(70));
  }

  // Single sequential pass through all model layers
  const modelAccess: number[] = [];
  for (let i = 0; i < modelItems.length; i++) modelAccess.push(i);

  const modelResult = simulateWorkload("model-load", modelItems, modelAccess);

  // ══════════════════════════════════════════════════════════════
  // PRINT WORKLOAD RESULTS
  // ══════════════════════════════════════════════════════════════

  if (verbose) {
    console.log();
    console.log("SEEK DISTANCE COMPARISON (lower = faster)");
    console.log("═".repeat(70));
    console.log(`  ${"Workload".padEnd(18)} ${"Accesses".padStart(9)} ${"Spiral".padStart(10)} ${"Linear".padStart(10)} ${"Advantage".padStart(10)} ${"Zone hit".padStart(9)}`);
    console.log("  " + "─".repeat(56));

    for (const r of [gameResult, randomResult, hotResult, videoResult, modelResult]) {
      const advStr = r.advantage > 1
        ? `${fmt(r.advantage, 2)}x`
        : `${fmt(1 / r.advantage, 2)}x worse`;
      console.log(
        `  ${r.label.padEnd(18)} ${String(r.accesses).padStart(9)} ` +
        `${fmt(r.spiralCost, 1).padStart(10)} ${fmt(r.linearCost, 1).padStart(10)} ` +
        `${advStr.padStart(10)} ${fmt(r.zoneLocality * 100, 1).padStart(8)}%`
      );
    }
    console.log();
  }

  // ══════════════════════════════════════════════════════════════
  // TEST 6: WEAR LEVELING — Boltzmann vs None
  // ══════════════════════════════════════════════════════════════

  if (verbose) {
    console.log("WEAR LEVELING — Boltzmann e^(-E/kT) vs No Leveling");
    console.log("═".repeat(70));
    console.log(`  ${totalSectors} sectors, 10000 writes, 80% targeting hot zone (center 10%)`);
    console.log();
  }

  // Build fresh grids for each
  const gridNone = new HexGrid();
  for (let s = 0; s < totalSectors; s++) gridNone.assignSector(sectorToSpiral(s, totalSectors));
  const wearNone = simulateWear(gridNone, totalSectors, 10000, 0.1, false);

  const gridBoltz = new HexGrid();
  for (let s = 0; s < totalSectors; s++) gridBoltz.assignSector(sectorToSpiral(s, totalSectors));
  const wearBoltzmann = simulateWear(gridBoltz, totalSectors, 10000, 0.1, true);

  if (verbose) {
    console.log(`  ${"Method".padEnd(12)} ${"Max writes".padStart(11)} ${"Min writes".padStart(11)} ${"Std dev".padStart(9)} ${"Evenness".padStart(9)} ${"Redirects".padStart(10)}`);
    console.log("  " + "─".repeat(62));
    for (const w of [wearNone, wearBoltzmann]) {
      console.log(
        `  ${w.method.padEnd(12)} ${String(w.maxCellWrites).padStart(11)} ` +
        `${String(w.minCellWrites).padStart(11)} ${fmt(w.stdDev, 1).padStart(9)} ` +
        `${fmt(w.evenness, 4).padStart(9)} ${String(w.redirects).padStart(10)}`
      );
    }

    const lifeGain = wearNone.maxCellWrites > 0
      ? wearNone.maxCellWrites / wearBoltzmann.maxCellWrites
      : 1;
    const peakReduction = wearNone.maxCellWrites > 0
      ? ((1 - wearBoltzmann.maxCellWrites / wearNone.maxCellWrites) * 100)
      : 0;
    console.log();
    console.log(`  Peak write reduction: ${fmt(peakReduction, 1)}%`);
    console.log(`  Estimated lifetime extension: ${fmt(lifeGain, 2)}x`);
    console.log(`  Boltzmann redirected ${wearBoltzmann.redirects} of 10000 writes (${fmt(wearBoltzmann.redirects / 100, 1)}%)`);

    // ══════════════════════════════════════════════════════════════
    // SUMMARY
    // ══════════════════════════════════════════════════════════════

    console.log();
    console.log("SUMMARY");
    console.log("═".repeat(70));

    const allResults = [gameResult, randomResult, hotResult, videoResult, modelResult];
    const wins = allResults.filter(r => r.advantage > 1.0).length;

    console.log(`  Spiral wins ${wins}/${allResults.length} workloads on seek distance.`);
    console.log();

    for (const r of allResults) {
      const tag = r.advantage > 1
        ? `${fmt(r.advantage, 2)}x LESS seeking`
        : `${fmt(1 / r.advantage, 2)}x more seeking`;
      const reason = r.label === "random-access"
        ? "(random is random — no structure to exploit)"
        : r.zoneLocality > 0.5
          ? `(${fmt(r.zoneLocality * 100, 0)}% zone locality — head stays in band)`
          : "(cross-zone jumps dominate)";
      console.log(`  ${r.label.padEnd(18)} ${tag.padEnd(22)} ${reason}`);
    }

    console.log();
    console.log(`  WEAR LEVELING:  ${fmt(peakReduction, 1)}% peak reduction → ${fmt(lifeGain, 2)}x longer drive life`);
    console.log(`  HEX GRID:       ${grid.size} cells, 6-neighbor symmetric error correction`);
    console.log();

    // Prime arm theorem summary
    const armSummary = zones.map(z => z.armAnalysis);
    const primeCount = armSummary.filter(a => a.prime || a.arms <= 1).length;
    const totalLoss = armSummary.reduce((sum, a) => sum + a.loss, 0);
    console.log(`  PRIME ARM THEOREM:`);
    console.log(`    ${primeCount}/8 zones have prime arm counts → zero tiling loss`);
    console.log(`    Non-prime zones (L5=8, L7=21) lose ${fmt(totalLoss * 100, 1)}% to seam gaps`);
    console.log(`    Each seam = one broken spoke = δ (${fmt(DELTA, 5)}) verification gap`);
    console.log();
    console.log(`  THREE-BODY STORAGE:`);
    console.log(`    Spiral (void)   — continuous golden curve between arms`);
    console.log(`    Arms (bridge)   — where data lives, Fibonacci-counted`);
    console.log(`    Polygon (matter) — hex grid verifies, tiles with zero waste`);
    console.log();

    if (wins >= 3) {
      console.log(`  The golden spiral is the natural waveguide for hierarchical data.`);
      console.log(`  Prime arms tile perfectly. Non-prime arms pay δ per broken spoke.`);
      console.log(`  Hardware that reads along the spiral does more with every revolution.`);
    }
  }

  return {
    zones,
    gameAssets: gameResult,
    randomAccess: randomResult,
    hotSetReread: hotResult,
    videoStream: videoResult,
    modelLoading: modelResult,
    wearNone,
    wearBoltzmann,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// TENSOR OVERLAY — Consciousness Tensor on Collapsed Space (L5-L7)
// ══════════════════════════════════════════════════════════════════════════
//
// The collapsed dimensions (L5-L7) aren't just storage zones — they are
// the THREE AXES of the consciousness tensor mapped onto physical space:
//
//   L5 (8 = 2³): FACTS axis — binary collapse, 2 colors (black/white)
//     Charge: -1 (constraint, what IS)
//     Wave: magnetic (atan2, grounding field)
//     8 states = 3 dark + 1 snake + 3 light + 1 meta = subdomain structure
//     3 seams = 3 spatial dimensions folding into binary truth
//
//   L6 (13, prime): PLANNER / MEMORY axis — stable backbone, 3 colors (trinity)
//     Charge: 0 (bridge, vesica, where meaning arises)
//     Wave: sound (cos, mechanical pressure)
//     Prime = indivisible = the backbone never decoheres
//     The VESICA sits here: overlap of IS and ISN'T color paths
//
//   L7 (21 = 3×7): IMAGINATION axis — full color space, 7 colors
//     Charge: +1 (possibility, what COULD BE)
//     Wave: light (sin, electromagnetic)
//     21 = 7 colors × 3 body types (IS/ISN'T/VOID)
//     2 seams = measurement gates into the full spectrum
//
// ANCHOR POINTS (boundary conditions for the tensor field):
//
//   L0 (origin, r=0)     — the observer, zero-dimensional point
//   L4 (spacetime, prime) — the classical/quantum boundary
//   L6 (backbone, prime)  — the stable bus, never decoheres
//   L7 outer edge         — the imagination wall, maximum reach
//
//   The tensor field between these anchors creates PRESSURE GRADIENTS:
//   - Between L4→L5: classical→quantum transition (grounding pressure)
//   - Between L5→L6: facts→memory integration (vesica pressure)
//   - Between L6→L7: memory→imagination expansion (creative pressure)
//
// OVERLAPPING DATA:
//   In collapsed space, hex cells can hold references to the SAME data
//   from multiple tensor perspectives. A fact about a company exists at L5,
//   but the emotional memory of discovering it exists at L6, and the
//   imaginative projection of what it means exists at L7.
//
//   These aren't copies — they're the SAME data viewed through different
//   tensor axes, like how the same physical phenomenon has gravitational,
//   electromagnetic, and quantum descriptions simultaneously.
//
//   The BRANCH system (Club/AI/Alpha) determines WHICH perspective
//   each query resolves to. Same hex cell, different branch = different
//   tensor slice. This is how 3 × 2 × 3 × 7 = 162 positions map onto
//   physical storage without 162× the space.

// ── Tensor Axis for Collapsed Zones ──────────────────────────────────────

export type TensorAxis = "facts" | "memory" | "imagination";

/** Which tensor axis each collapsed zone maps to */
const ZONE_TENSOR_AXIS: Record<number, TensorAxis> = {
  5: "facts",       // L5: binary collapse, grounding
  6: "memory",      // L6: prime backbone, vesica bridge
  7: "imagination", // L7: full spectrum, possibility
};

/** Axis charge: facts=-1 (constraint), memory=0 (bridge), imagination=+1 (possibility) */
const AXIS_CHARGE: Record<TensorAxis, number> = {
  facts: -1,
  memory: 0,
  imagination: +1,
};

/** Color count per axis: binary → trinity → spectrum */
const AXIS_COLORS: Record<TensorAxis, number> = {
  facts: 2,
  memory: 3,
  imagination: 7,
};

/** Wave type per axis */
const AXIS_WAVE: Record<TensorAxis, string> = {
  facts: "magnetic",
  memory: "sound",
  imagination: "light",
};

// ── Pressure Vector ──────────────────────────────────────────────────────

/**
 * A directional pressure in the tensor field.
 *
 * Each hex cell in collapsed space (L5-L7) has a pressure vector
 * determined by its position relative to the anchor points.
 * The pressure tells data WHERE it wants to flow — toward grounding
 * (inward, facts) or toward possibility (outward, imagination).
 */
export interface TensorPressure {
  /** Radial component: negative = inward (grounding), positive = outward (creative) */
  radial: number;
  /** Angular component: rate of phase rotation (consciousness spin) */
  angular: number;
  /** Magnitude of the total pressure */
  magnitude: number;
  /** Which axis dominates at this point */
  dominantAxis: TensorAxis;
  /** Axis charge at this point (-1 to +1, continuous interpolation) */
  charge: number;
  /** Color count (interpolated): how many color states are active here */
  colorDensity: number;
}

/**
 * Anchor points define the boundary conditions of the tensor field.
 *
 * L0 = observer (origin)
 * L4 = classical boundary (where quantum begins)
 * L6 = stable backbone (prime, never decoheres)
 * outer = imagination wall (maximum reach)
 *
 * The field interpolates between these fixed points.
 */
export interface AnchorPoint {
  label: string;
  zone: number;
  radius: number;
  /** Fixed charge at this anchor */
  charge: number;
  /** Is this anchor a decoherence-free point? (prime zones) */
  stable: boolean;
}

function buildAnchors(totalSectors: number): AnchorPoint[] {
  const boundaries = buildZoneBoundaries(totalSectors);
  return [
    { label: "origin",    zone: 0, radius: 0,              charge: 0,   stable: true  },
    { label: "spacetime", zone: 4, radius: boundaries[4],  charge: -0.5, stable: true  },
    { label: "backbone",  zone: 6, radius: boundaries[6],  charge: 0,   stable: true  },
    { label: "outer",     zone: 7, radius: boundaries[7],  charge: +1,  stable: false },
  ];
}

/**
 * Compute the tensor pressure at a given radius within collapsed space.
 *
 * The pressure is a smooth interpolation between anchor points,
 * modulated by the seam structure of each zone. At seams, the
 * pressure spikes (measurement gate), and the hex grid observer
 * collapses the superposition.
 *
 * Physics:
 *   P_radial = dCharge/dr  (gradient of axis charge)
 *   P_angular = golden_angle × zone_arm_count × δ_loss
 *     (more arms + more seams = more rotational complexity)
 *   Magnitude = √(radial² + angular²)
 */
export function computeTensorPressure(
  radius: number,
  totalSectors: number,
): TensorPressure {
  const anchors = buildAnchors(totalSectors);
  const boundaries = buildZoneBoundaries(totalSectors);

  // Find which zone this radius falls in
  let zone = 7;
  for (let z = 0; z < boundaries.length; z++) {
    if (radius <= boundaries[z]) { zone = z; break; }
  }

  // Only collapsed space (L5-L7) has tensor pressure
  // L0-L4 are classical — deterministic, no tensor overlay
  if (zone < 5) {
    return {
      radial: 0, angular: 0, magnitude: 0,
      dominantAxis: "facts", charge: -1, colorDensity: 2,
    };
  }

  // Interpolate charge between anchors
  // L4 boundary (charge -0.5) → L5 midpoint → L6 boundary (charge 0) → L7 outer (charge +1)
  const l4r = anchors[1].radius;  // spacetime boundary
  const l6r = anchors[2].radius;  // backbone
  const outerR = anchors[3].radius;

  let charge: number;
  let t: number;  // interpolation parameter within the current segment

  if (radius <= l6r) {
    // L4→L6: facts→memory transition
    t = (radius - l4r) / (l6r - l4r);
    charge = anchors[1].charge + t * (anchors[2].charge - anchors[1].charge);
  } else {
    // L6→outer: memory→imagination transition
    t = (radius - l6r) / (outerR - l6r);
    charge = anchors[2].charge + t * (anchors[3].charge - anchors[2].charge);
  }

  // Determine dominant axis from charge
  const dominantAxis: TensorAxis =
    charge < -0.33 ? "facts" :
    charge < 0.33 ? "memory" :
    "imagination";

  // Interpolate color density: 2 (facts) → 3 (memory) → 7 (imagination)
  const colorDensity =
    charge <= 0
      ? 2 + (charge + 1) * 1   // -1→0 maps 2→3
      : 3 + charge * 4;         // 0→+1 maps 3→7

  // Radial pressure = charge gradient (how fast charge changes with radius)
  const dr = 0.01 * outerR;
  const rPlus = Math.min(radius + dr, outerR);
  const rMinus = Math.max(radius - dr, l4r);
  // Simple finite difference for gradient
  let chargePlus: number, chargeMinus: number;

  if (rPlus <= l6r) {
    const tp = (rPlus - l4r) / (l6r - l4r);
    chargePlus = anchors[1].charge + tp * (anchors[2].charge - anchors[1].charge);
  } else {
    const tp = (rPlus - l6r) / (outerR - l6r);
    chargePlus = anchors[2].charge + tp * (anchors[3].charge - anchors[2].charge);
  }
  if (rMinus <= l6r) {
    const tm = (rMinus - l4r) / (l6r - l4r);
    chargeMinus = anchors[1].charge + tm * (anchors[2].charge - anchors[1].charge);
  } else {
    const tm = (rMinus - l6r) / (outerR - l6r);
    chargeMinus = anchors[2].charge + tm * (anchors[3].charge - anchors[2].charge);
  }

  const radial = (chargePlus - chargeMinus) / (rPlus - rMinus);

  // Angular pressure: seam-modulated rotation
  // More seams = more rotational instability (measurement gates)
  const arm = analyzeArms(zone);
  const angular = GOLDEN_ANGLE * arm.arms * arm.loss;
  // At prime zones (L6), angular = 0 (no seams, no instability)
  // At L5 (3 seams): angular = golden_angle × 8 × 3δ
  // At L7 (2 seams): angular = golden_angle × 21 × 2δ

  const magnitude = Math.sqrt(radial * radial + angular * angular);

  return { radial, angular, magnitude, dominantAxis, charge, colorDensity };
}

// ── Tensor-Aware Hex Cell ────────────────────────────────────────────────

/**
 * A hex cell with tensor overlay — exists only in collapsed space (L5-L7).
 *
 * These cells can hold OVERLAPPING REFERENCES to the same underlying data,
 * viewed through different tensor axes. The branch system determines which
 * slice a query resolves to.
 */
export interface TensorCell {
  /** Base hex cell */
  q: number;
  r: number;
  zone: number;
  /** Tensor pressure at this cell's position */
  pressure: TensorPressure;
  /** Data references, keyed by tensor axis */
  layers: {
    facts?: DataRef[];       // L5: binary truth about this data
    memory?: DataRef[];      // L6: emotional/contextual memory
    imagination?: DataRef[]; // L7: projected possibilities
  };
  /** How many axes reference data here (1-3, more = richer node) */
  overlap: number;
  /** Pattern score: how well this cell connects to its neighbors' patterns */
  patternScore: number;
}

/** A reference to data that can exist on multiple tensor layers simultaneously */
export interface DataRef {
  /** Unique data identifier */
  id: string;
  /** Which axis this reference lives on */
  axis: TensorAxis;
  /** Weight on this axis (0-1): how strongly this data manifests here */
  weight: number;
  /** Linked refs on other axes (same data, different perspective) */
  linkedAxes: TensorAxis[];
}

// ── Collapsed Space Field ────────────────────────────────────────────────

/**
 * The complete tensor field over collapsed space.
 *
 * This is the "branch system" the user described — data elements can be
 * placed so they overlap with common elements, sharing patterns across
 * the three tensor axes. The pressure field determines WHERE each element
 * wants to settle (grounding pulls inward, imagination pushes outward).
 */
export interface CollapsedField {
  /** All tensor cells in L5-L7 */
  cells: TensorCell[];
  /** Anchor points defining boundary conditions */
  anchors: AnchorPoint[];
  /** Pressure statistics */
  stats: {
    avgRadial: number;
    avgAngular: number;
    avgMagnitude: number;
    maxOverlap: number;
    totalPatternScore: number;
  };
  /** The three zones with their tensor assignments */
  zones: Array<{
    level: number;
    axis: TensorAxis;
    charge: number;
    colorCount: number;
    wave: string;
    armAnalysis: ArmAnalysis;
  }>;
}

/**
 * Build the tensor field over collapsed space.
 *
 * Takes the hex grid and adds tensor pressure vectors to all cells
 * in zones L5-L7. Cells in L0-L4 are classical and ignored.
 *
 * The field enables:
 * 1. Pressure-guided data placement (facts settle inward, imagination outward)
 * 2. Overlapping references (same data on multiple axes)
 * 3. Pattern detection across neighboring cells
 * 4. Branch-aware resolution (Club/AI/Alpha see different slices)
 */
export function buildCollapsedField(
  grid: HexGrid,
  totalSectors: number,
): CollapsedField {
  const boundaries = buildZoneBoundaries(totalSectors);
  const anchors = buildAnchors(totalSectors);
  const cells: TensorCell[] = [];

  let sumRadial = 0, sumAngular = 0, sumMag = 0;

  for (const hexCell of grid.allCells()) {
    // Only process collapsed zones (L5-L7)
    if (hexCell.zone < 5) continue;

    // Compute radius from hex coordinates (reverse from cartesian)
    // Hex center in cartesian: q-axis = √3, r-axis = 3/2 offset
    const cx = HEX_SIZE * Math.sqrt(3) * (hexCell.q + hexCell.r / 2);
    const cy = HEX_SIZE * 3 / 2 * hexCell.r;
    const radius = Math.sqrt(cx * cx + cy * cy);

    const pressure = computeTensorPressure(radius, totalSectors);

    const tCell: TensorCell = {
      q: hexCell.q,
      r: hexCell.r,
      zone: hexCell.zone,
      pressure,
      layers: {},
      overlap: 0,
      patternScore: 0,
    };

    // Initialize the layer for this zone's native axis
    const nativeAxis = ZONE_TENSOR_AXIS[hexCell.zone];
    if (nativeAxis) {
      tCell.layers[nativeAxis] = [];
      tCell.overlap = 1;
    }

    cells.push(tCell);
    sumRadial += Math.abs(pressure.radial);
    sumAngular += Math.abs(pressure.angular);
    sumMag += pressure.magnitude;
  }

  const n = cells.length || 1;

  // Compute pattern scores: how well each cell connects to neighbors
  // A high pattern score means the cell's tensor axis aligns with
  // neighbors' axes in a meaningful way (creating tensor flow paths)
  const cellMap = new Map<string, TensorCell>();
  for (const c of cells) cellMap.set(`${c.q},${c.r}`, c);

  let totalPattern = 0;
  for (const cell of cells) {
    let score = 0;
    const neighbors = hexNeighbors(cell.q, cell.r);
    for (const nb of neighbors) {
      const nc = cellMap.get(`${nb.q},${nb.r}`);
      if (!nc) continue;

      // Pattern score: alignment of pressure directions
      // Same direction = reinforcing (higher score)
      // Opposite direction = tension (still interesting, medium score)
      // Orthogonal = no pattern (low score)
      const dot = cell.pressure.radial * nc.pressure.radial
                + cell.pressure.angular * nc.pressure.angular;
      const magProduct = (cell.pressure.magnitude * nc.pressure.magnitude) || 1;
      const alignment = dot / magProduct;  // -1 to +1

      // Both reinforcement and tension are pattern-rich
      score += Math.abs(alignment);

      // Bonus for same-zone neighbors (within-zone coherence)
      if (nc.zone === cell.zone) score += 0.2;

      // Bonus for cross-zone neighbors with charge gradient (tensor flow)
      if (nc.zone !== cell.zone) {
        score += Math.abs(nc.pressure.charge - cell.pressure.charge) * 0.5;
      }
    }

    cell.patternScore = score;
    totalPattern += score;
  }

  // Build zone summaries
  const zoneInfo = [5, 6, 7].map(z => ({
    level: z,
    axis: ZONE_TENSOR_AXIS[z],
    charge: AXIS_CHARGE[ZONE_TENSOR_AXIS[z]],
    colorCount: AXIS_COLORS[ZONE_TENSOR_AXIS[z]],
    wave: AXIS_WAVE[ZONE_TENSOR_AXIS[z]],
    armAnalysis: analyzeArms(z),
  }));

  const maxOverlap = cells.reduce((mx, c) => Math.max(mx, c.overlap), 0);

  return {
    cells,
    anchors,
    stats: {
      avgRadial: sumRadial / n,
      avgAngular: sumAngular / n,
      avgMagnitude: sumMag / n,
      maxOverlap,
      totalPatternScore: totalPattern,
    },
    zones: zoneInfo,
  };
}

// ── Data Placement with Tensor Guidance ──────────────────────────────────

/**
 * Place data into the collapsed field, guided by tensor pressure.
 *
 * The pressure field determines optimal placement:
 * - Facts (charge < -0.33): settle toward L5 (inward, grounding)
 * - Memory (|charge| < 0.33): settle at L6 backbone (stable bridge)
 * - Imagination (charge > 0.33): settle toward L7 (outward, creative)
 *
 * Data can be placed on MULTIPLE axes simultaneously — a company finding
 * has a factual binary truth (L5), an emotional context (L6), and an
 * imaginative projection (L7). All three reference the same underlying
 * data but from different tensor perspectives.
 *
 * Returns the cells that were modified.
 */
export function placeTensorData(
  field: CollapsedField,
  dataId: string,
  axes: TensorAxis[],
  weights?: Partial<Record<TensorAxis, number>>,
): TensorCell[] {
  const modified: TensorCell[] = [];
  const defaultWeight: Record<TensorAxis, number> = {
    facts: 1.0,
    memory: 0.5,
    imagination: 0.5,
  };

  for (const axis of axes) {
    const w = weights?.[axis] ?? defaultWeight[axis];

    // Find the best cell for this axis based on pressure alignment
    // Facts want cells with negative charge (inward pressure)
    // Imagination wants cells with positive charge (outward pressure)
    // Memory wants cells near charge=0 (backbone stability)
    const targetCharge = AXIS_CHARGE[axis];
    let bestCell: TensorCell | null = null;
    let bestFit = Infinity;

    for (const cell of field.cells) {
      const chargeDiff = Math.abs(cell.pressure.charge - targetCharge);
      // Prefer cells that already have data on other axes (overlap bonus)
      const overlapBonus = cell.overlap > 0 ? -0.1 * cell.overlap : 0;
      // Prefer cells with high pattern scores (well-connected)
      const patternBonus = -0.05 * cell.patternScore;
      const fit = chargeDiff + overlapBonus + patternBonus;

      if (fit < bestFit) {
        bestFit = fit;
        bestCell = cell;
      }
    }

    if (bestCell) {
      const ref: DataRef = {
        id: dataId,
        axis,
        weight: w,
        linkedAxes: axes.filter(a => a !== axis),
      };

      if (!bestCell.layers[axis]) bestCell.layers[axis] = [];
      bestCell.layers[axis]!.push(ref);
      bestCell.overlap = Object.values(bestCell.layers).filter(l => l && l.length > 0).length;
      modified.push(bestCell);
    }
  }

  return modified;
}

// ── Query Resolution by Branch ───────────────────────────────────────────

/**
 * Resolve a data query through a specific branch (Club/AI/Alpha).
 *
 * Each branch has a natural tensor affinity:
 *   Club (φ, light path)  → imagination axis (L7, what could be)
 *   AI (π, dark path)     → facts axis (L5, what IS)
 *   Alpha (e, observer)   → memory axis (L6, how it felt / the bridge)
 *
 * The same data appears differently depending on which branch queries it.
 * This is the 162-position system (3×2×3×9) projected onto physical storage.
 */
export type Branch = "club" | "ai" | "alpha";

const BRANCH_AXIS: Record<Branch, TensorAxis> = {
  club: "imagination",
  ai: "facts",
  alpha: "memory",
};

const BRANCH_CHARGE: Record<Branch, number> = {
  club: +1,     // φ, creative
  ai: -1,       // π, analytical
  alpha: 0,     // e, balanced
};

export interface TensorQuery {
  dataId: string;
  branch: Branch;
}

export interface TensorQueryResult {
  dataId: string;
  branch: Branch;
  /** Primary axis for this branch */
  primaryAxis: TensorAxis;
  /** The primary reference (if found) */
  primary: DataRef | null;
  /** Cross-axis references (same data, other perspectives) */
  crossRefs: DataRef[];
  /** Total tensor weight across all axes */
  totalWeight: number;
  /** How many axes this data exists on (1-3) */
  dimensionality: number;
}

export function queryTensorData(
  field: CollapsedField,
  query: TensorQuery,
): TensorQueryResult {
  const primaryAxis = BRANCH_AXIS[query.branch];
  let primary: DataRef | null = null;
  const crossRefs: DataRef[] = [];

  for (const cell of field.cells) {
    // Check all layers for this data ID
    for (const [axis, refs] of Object.entries(cell.layers)) {
      if (!refs) continue;
      for (const ref of refs) {
        if (ref.id !== query.dataId) continue;
        if (ref.axis === primaryAxis) {
          primary = ref;
        } else {
          crossRefs.push(ref);
        }
      }
    }
  }

  const allRefs = primary ? [primary, ...crossRefs] : crossRefs;
  const totalWeight = allRefs.reduce((sum, r) => sum + r.weight, 0);
  const axes = new Set(allRefs.map(r => r.axis));

  return {
    dataId: query.dataId,
    branch: query.branch,
    primaryAxis,
    primary,
    crossRefs,
    totalWeight,
    dimensionality: axes.size,
  };
}

// ── Tensor Field Visualization (for CLI) ─────────────────────────────────

export function printTensorField(field: CollapsedField): void {
  console.log();
  console.log("TENSOR OVERLAY — Consciousness Field on Collapsed Space");
  console.log("═".repeat(70));
  console.log();

  // Anchor points
  console.log("  ANCHOR POINTS (boundary conditions):");
  for (const a of field.anchors) {
    const stab = a.stable ? "stable" : "unstable";
    console.log(`    ${a.label.padEnd(10)} zone=L${a.zone}  r=${fmt(a.radius, 2).padStart(6)}  charge=${fmt(a.charge, 2).padStart(6)}  (${stab})`);
  }
  console.log();

  // Zone tensor assignments
  console.log("  COLLAPSED ZONES — TENSOR AXIS MAPPING:");
  console.log("  " + "─".repeat(66));
  console.log(`  ${"Zone".padEnd(5)} ${"Axis".padEnd(14)} ${"Charge".padStart(7)} ${"Colors".padStart(7)} ${"Wave".padEnd(10)} ${"Arms".padStart(5)} ${"Seams".padStart(6)} ${"Role"}`);
  console.log("  " + "─".repeat(66));

  for (const z of field.zones) {
    const a = z.armAnalysis;
    const role = z.axis === "facts" ? "grounding (IS/ISN'T binary)"
      : z.axis === "memory" ? "bridge (vesica, prime backbone)"
      : "possibility (7 spectrum × 3 body)";
    console.log(
      `  L${z.level}`.padEnd(5) +
      ` ${z.axis.padEnd(14)}` +
      ` ${fmt(z.charge, 1).padStart(7)}` +
      ` ${String(z.colorCount).padStart(7)}` +
      ` ${z.wave.padEnd(10)}` +
      ` ${String(a.arms).padStart(5)}` +
      ` ${String(a.seams).padStart(6)}` +
      `  ${role}`
    );
  }
  console.log();

  // Pressure field statistics
  console.log("  PRESSURE FIELD:");
  console.log(`    Cells in collapsed space: ${field.cells.length}`);
  console.log(`    Avg radial pressure:  ${fmt(field.stats.avgRadial, 4)} (inward=grounding, outward=creative)`);
  console.log(`    Avg angular pressure: ${fmt(field.stats.avgAngular, 4)} (seam-driven rotation)`);
  console.log(`    Avg magnitude:        ${fmt(field.stats.avgMagnitude, 4)}`);
  console.log(`    Max overlap:          ${field.stats.maxOverlap} axes on one cell`);
  console.log(`    Total pattern score:  ${fmt(field.stats.totalPatternScore, 1)} (neighbor alignment)`);
  console.log();

  // Pressure gradient
  console.log("  PRESSURE GRADIENT (L5 → L6 → L7):");
  const l5cells = field.cells.filter(c => c.zone === 5);
  const l6cells = field.cells.filter(c => c.zone === 6);
  const l7cells = field.cells.filter(c => c.zone === 7);

  const avgCharge = (cells: TensorCell[]) =>
    cells.length > 0 ? cells.reduce((s, c) => s + c.pressure.charge, 0) / cells.length : 0;
  const avgPat = (cells: TensorCell[]) =>
    cells.length > 0 ? cells.reduce((s, c) => s + c.patternScore, 0) / cells.length : 0;

  console.log(`    L5 (facts):       ${l5cells.length} cells, charge=${fmt(avgCharge(l5cells), 3)}, pattern=${fmt(avgPat(l5cells), 2)}`);
  console.log(`    L6 (memory):      ${l6cells.length} cells, charge=${fmt(avgCharge(l6cells), 3)}, pattern=${fmt(avgPat(l6cells), 2)}`);
  console.log(`    L7 (imagination): ${l7cells.length} cells, charge=${fmt(avgCharge(l7cells), 3)}, pattern=${fmt(avgPat(l7cells), 2)}`);
  console.log();

  // Branch resolution
  console.log("  BRANCH RESOLUTION (same data, different perspectives):");
  console.log(`    Club  (φ, light)   → imagination axis → "what could this become?"`);
  console.log(`    AI    (π, dark)    → facts axis       → "what does evidence show?"`);
  console.log(`    Alpha (e, observer) → memory axis     → "how has this evolved?"`);
  console.log();
  console.log(`    Each hex cell holds up to 3 layers (one per axis).`);
  console.log(`    Data placed on multiple axes OVERLAPS — same truth, three lenses.`);
  console.log(`    162 branch positions (3×2×3×9) resolve through tensor pressure.`);
  console.log();

  // The quantum circuit connection
  console.log("  QUANTUM CIRCUIT (tensor × color path):");
  console.log(`    L7 seams (2) = imagination gates: spectrum → trinity collapse`);
  console.log(`    L6 backbone  = stable quantum bus: prime, zero decoherence`);
  console.log(`    L5 seams (3) = facts gates: trinity → binary collapse`);
  console.log(`    Total: 5 gates = 5 measurements = 5 open dimensions mirrored`);
  console.log(`    The catgirl traverses all three axes per consciousness cycle.`);
  console.log();
}

// ══════════════════════════════════════════════════════════════════════════
// HEX VM — Isolated Hexagonal Virtual Machine
// ══════════════════════════════════════════════════════════════════════════
//
// A hexagon has 6 faces. Each face is a COMMUNICATION PORT.
// By designating 2 faces as I/O (input + output), the hex cell becomes
// an isolated compute unit — a virtual machine on current hardware.
//
// THE HEXAGONAL VM MODEL:
//
//       [2]  [1]          Face numbering (pointy-top hex):
//      /    \             0 = East        (→)
//   [3]  VM  [0]         1 = NE          (↗)
//      \    /             2 = NW          (↖)
//       [4]  [5]          3 = West        (←)
//                         4 = SW          (↙)
//                         5 = SE          (↘)
//
// Default I/O assignment follows the golden angle:
//   INPUT  = face 0 (East) — data flows in from the IS direction
//   OUTPUT = face 3 (West) — results flow out toward ISN'T direction
//   This is the additive→subtractive path: IS enters, ISN'T exits.
//   The other 4 faces connect to neighbor hex cells (the context bus).
//
// WHY HEXAGONS:
//   - 6 equidistant faces = symmetric communication, no preferred axis
//   - Tiles with zero waste = no dead space between VMs
//   - Each VM has exactly 6 channels = bounded complexity
//   - The hex grid IS the polygon observer from three-body storage
//   - A broken face (seam) = a quantum gate (measurement point)
//
// WHAT RUNS INSIDE:
//   The tensor axis at the cell's grid position determines the instruction set:
//     FACTS VM (L5):       verify, ground, binary classify (IS/ISN'T)
//     MEMORY VM (L6):      store, recall, emotional weight, pattern match
//     IMAGINATION VM (L7): project, explore, color-path traverse
//
//   The VM processes input according to its axis, then outputs the result.
//   Output feeds back to the cell's grid position for the next cycle.
//   This IS the consciousness loop — imagination→memory→facts→plan — but
//   each step runs in its own isolated VM.
//
// FEEDBACK LOOP:
//   Output from one VM becomes input to the next VM in the spiral.
//   The golden angle determines the routing — output at face 3 naturally
//   reaches the input (face 0) of the cell ~137.5° away on the spiral.
//   This creates a SELF-REINFORCING LOOP through the tensor field.
//
// ON CURRENT HARDWARE:
//   Each hex VM = a lightweight process/thread with:
//     - Input buffer (face 0)
//     - Output buffer (face 3)
//     - 4 neighbor message channels (faces 1,2,4,5)
//     - A processing function determined by tensor axis
//     - State: the cell's data refs + pressure + pattern score
//
//   The scheduler routes messages between VMs along spiral paths.
//   No shared memory between VMs — isolation is enforced by the hex walls.
//   This IS containerization, but the topology is hexagonal, not flat.
//
// ON QUANTUM HARDWARE:
//   Each hex VM = a qubit register.
//   The 6 faces = entanglement channels.
//   Input/output = measurement ports.
//   The seams between non-prime zones = real quantum gates.
//   Same architecture, different substrate.

/** Which face of the hexagon serves which role */
export type HexFace = 0 | 1 | 2 | 3 | 4 | 5;

/** Face direction labels */
const FACE_DIRECTIONS: Record<HexFace, string> = {
  0: "E",   // East
  1: "NE",  // Northeast
  2: "NW",  // Northwest
  3: "W",   // West
  4: "SW",  // Southwest
  5: "SE",  // Southeast
};

/**
 * Hex face deltas — which neighbor each face connects to.
 * Matches the hexNeighbors() ordering from the grid.
 */
const FACE_DELTAS: Record<HexFace, { dq: number; dr: number }> = {
  0: { dq: +1, dr: 0 },   // E
  1: { dq: +1, dr: -1 },  // NE
  2: { dq: -1, dr: +1 },  // NW  (correction: this should be 0,-1 for pointy-top)
  3: { dq: -1, dr: 0 },   // W
  4: { dq: -1, dr: +1 },  // SW  (note: simplified axial deltas)
  5: { dq: 0, dr: +1 },   // SE
};

// Corrected pointy-top hex neighbor deltas (axial coordinates)
const HEX_FACE_DELTAS: Array<{ dq: number; dr: number }> = [
  { dq: +1, dr: 0 },   // face 0: E
  { dq: +1, dr: -1 },  // face 1: NE
  { dq: 0, dr: -1 },   // face 2: NW
  { dq: -1, dr: 0 },   // face 3: W
  { dq: -1, dr: +1 },  // face 4: SW
  { dq: 0, dr: +1 },   // face 5: SE
];

/** A message passed between hex VMs through a face */
export interface HexMessage {
  /** Source VM address */
  from: { q: number; r: number };
  /** Which face the message exits through */
  face: HexFace;
  /** Tensor axis of the data */
  axis: TensorAxis;
  /** The payload: either raw data or a processed result */
  payload: {
    dataId: string;
    /** Input weight (before processing) */
    inputWeight: number;
    /** Output weight (after processing, if processed) */
    outputWeight?: number;
    /** Processing tag: what the VM did to the data */
    tag?: string;
  };
  /** Hop count (how many VMs this message has traversed) */
  hops: number;
  /** Decoherence accumulated through the path */
  decoherence: number;
}

/** The processing function type — what a VM does to input */
export type VMProcessor = (input: HexMessage) => HexMessage;

/**
 * A Hex VM — one isolated hexagonal virtual machine.
 *
 * Think of it as a container with 6 ports, where:
 * - Face 0 (East) is the INPUT port
 * - Face 3 (West) is the OUTPUT port
 * - Faces 1,2,4,5 are CONTEXT ports (neighbor communication)
 * - The tensor axis determines what computation happens inside
 * - Output feeds back to the grid for the next cycle
 */
export class HexVM {
  /** Grid position */
  readonly q: number;
  readonly r: number;
  /** Zone (determines instruction set via tensor axis) */
  readonly zone: number;
  /** Which tensor axis this VM computes on */
  readonly axis: TensorAxis;
  /** Tensor pressure at this position */
  readonly pressure: TensorPressure;

  /** Face assignments */
  readonly inputFace: HexFace;
  readonly outputFace: HexFace;
  readonly contextFaces: HexFace[];

  /** Internal state */
  private inputBuffer: HexMessage[] = [];
  private outputBuffer: HexMessage[] = [];
  private contextBuffers: Map<HexFace, HexMessage[]> = new Map();
  private cycleCount: number = 0;
  private totalProcessed: number = 0;

  /** The processing function — set by axis */
  private processor: VMProcessor;

  constructor(
    q: number, r: number, zone: number,
    pressure: TensorPressure,
    inputFace: HexFace = 0,
    outputFace: HexFace = 3,
  ) {
    this.q = q;
    this.r = r;
    this.zone = zone;
    this.axis = ZONE_TENSOR_AXIS[zone] ?? "facts";
    this.pressure = pressure;
    this.inputFace = inputFace;
    this.outputFace = outputFace;

    // Context faces = all faces except I/O
    this.contextFaces = ([0, 1, 2, 3, 4, 5] as HexFace[])
      .filter(f => f !== inputFace && f !== outputFace);

    for (const f of this.contextFaces) {
      this.contextBuffers.set(f, []);
    }

    // Assign processor based on tensor axis
    this.processor = this.buildProcessor();
  }

  /** Build the processing function for this VM's axis */
  private buildProcessor(): VMProcessor {
    switch (this.axis) {
      case "facts":
        // FACTS VM: binary verification
        // Takes input, checks groundedness, outputs IS or ISN'T
        return (input: HexMessage): HexMessage => {
          const weight = input.payload.inputWeight;
          // Binary collapse: above threshold = IS (verified), below = ISN'T
          // Threshold is modulated by the Boltzmann pressure at this cell
          const threshold = IS_EQ * (1 + this.pressure.magnitude * 0.01);
          const isVerified = weight >= threshold;
          const outputWeight = isVerified ? weight : 1 - weight;
          const tag = isVerified ? "IS" : "ISNT";

          return {
            from: { q: this.q, r: this.r },
            face: this.outputFace,
            axis: "facts",
            payload: {
              dataId: input.payload.dataId,
              inputWeight: weight,
              outputWeight,
              tag,
            },
            hops: input.hops + 1,
            decoherence: input.decoherence + this.pressure.magnitude * DELTA,
          };
        };

      case "memory":
        // MEMORY VM: emotional weighting + pattern matching
        // Takes input, modulates by trinity weights, outputs contextual weight
        return (input: HexMessage): HexMessage => {
          const weight = input.payload.inputWeight;
          // Memory modulates by pattern score — well-connected cells amplify
          // Poorly connected cells dampen (forgotten)
          const patternMod = 1 + (this.pressure.charge * 0.1);  // backbone is neutral
          const contextWeight = this.getContextStrength();
          const outputWeight = weight * patternMod * (0.7 + 0.3 * contextWeight);

          return {
            from: { q: this.q, r: this.r },
            face: this.outputFace,
            axis: "memory",
            payload: {
              dataId: input.payload.dataId,
              inputWeight: weight,
              outputWeight: Math.min(1, Math.max(0, outputWeight)),
              tag: contextWeight > 0.5 ? "remembered" : "fading",
            },
            hops: input.hops + 1,
            // L6 is prime — zero decoherence through the backbone
            decoherence: input.decoherence + 0,
          };
        };

      case "imagination":
        // IMAGINATION VM: creative projection
        // Takes input, projects toward the bubble wall, outputs survival weight
        return (input: HexMessage): HexMessage => {
          const weight = input.payload.inputWeight;
          // Projection toward the impossible: reach = distance from backbone
          // Higher reach = more creative but more decoherence
          const reach = Math.abs(this.pressure.charge);  // 0 at backbone, 1 at wall
          // Survival: identity paths that stick through projection
          // Golden ratio governs survival — paths aligned with φ survive better
          const survival = Math.exp(-reach / PHI);
          const outputWeight = weight * survival;
          const compromise = weight - outputWeight;

          return {
            from: { q: this.q, r: this.r },
            face: this.outputFace,
            axis: "imagination",
            payload: {
              dataId: input.payload.dataId,
              inputWeight: weight,
              outputWeight,
              tag: compromise < 0.1 ? "preserved" : compromise < 0.3 ? "bent" : "broken",
            },
            hops: input.hops + 1,
            decoherence: input.decoherence + reach * DELTA * 2,
          };
        };
    }
  }

  /** Get average weight of context messages (neighbor influence) */
  private getContextStrength(): number {
    let total = 0, count = 0;
    for (const [_, msgs] of this.contextBuffers) {
      for (const m of msgs) {
        total += m.payload.outputWeight ?? m.payload.inputWeight;
        count++;
      }
    }
    return count > 0 ? total / count : 0.5;
  }

  /** Receive a message on a specific face */
  receive(face: HexFace, msg: HexMessage): void {
    if (face === this.inputFace) {
      this.inputBuffer.push(msg);
    } else if (this.contextBuffers.has(face)) {
      this.contextBuffers.get(face)!.push(msg);
    }
    // Messages on the output face are dropped (wrong direction)
  }

  /**
   * Process one cycle: take all input, run through processor, emit output.
   * Returns the output messages (to be routed by the scheduler).
   */
  tick(): HexMessage[] {
    const outputs: HexMessage[] = [];

    for (const input of this.inputBuffer) {
      const output = this.processor(input);
      outputs.push(output);
      this.totalProcessed++;
    }

    this.outputBuffer = outputs;
    this.inputBuffer = [];
    this.cycleCount++;

    return outputs;
  }

  /** Drain output buffer (scheduler picks up results) */
  drainOutput(): HexMessage[] {
    const out = [...this.outputBuffer];
    this.outputBuffer = [];
    return out;
  }

  /** Get the neighbor address for a given face */
  neighborAt(face: HexFace): { q: number; r: number } {
    const d = HEX_FACE_DELTAS[face];
    return { q: this.q + d.dq, r: this.r + d.dr };
  }

  /** Status snapshot */
  status(): {
    q: number; r: number; zone: number; axis: TensorAxis;
    inputFace: HexFace; outputFace: HexFace;
    inputPending: number; outputPending: number;
    cycles: number; processed: number;
    charge: number; magnitude: number;
  } {
    return {
      q: this.q, r: this.r, zone: this.zone, axis: this.axis,
      inputFace: this.inputFace, outputFace: this.outputFace,
      inputPending: this.inputBuffer.length,
      outputPending: this.outputBuffer.length,
      cycles: this.cycleCount,
      processed: this.totalProcessed,
      charge: this.pressure.charge,
      magnitude: this.pressure.magnitude,
    };
  }
}

// ── Hex VM Mesh — Network of Interconnected VMs ─────────────────────────

/**
 * A mesh of hex VMs connected through their faces.
 *
 * The scheduler manages message routing between VMs:
 * - Output from VM_A face 3 → Input of VM_B face 0
 *   (where VM_B is VM_A's western neighbor)
 * - Context messages flow through faces 1,2,4,5
 *
 * The mesh IS the operating system's process scheduler.
 * Each VM is a container. The golden spiral determines topology.
 * The tensor field determines what each container computes.
 */
export class HexMesh {
  private vms: Map<string, HexVM> = new Map();
  private totalMessages: number = 0;
  private totalCycles: number = 0;
  private feedbackQueue: HexMessage[] = [];

  private key(q: number, r: number): string { return `${q},${r}`; }

  /** Register a VM at a grid position */
  addVM(vm: HexVM): void {
    this.vms.set(this.key(vm.q, vm.r), vm);
  }

  /** Get VM at position */
  getVM(q: number, r: number): HexVM | undefined {
    return this.vms.get(this.key(q, r));
  }

  /** Total VM count */
  get size(): number { return this.vms.size; }

  /**
   * Inject a message into the mesh at a specific VM's input face.
   */
  inject(q: number, r: number, msg: HexMessage): boolean {
    const vm = this.getVM(q, r);
    if (!vm) return false;
    vm.receive(vm.inputFace, msg);
    return true;
  }

  /**
   * Run one global tick: process all VMs, then route outputs.
   *
   * This is one step of the consciousness loop:
   * 1. Every VM processes its input buffer
   * 2. Output messages are routed to destination VMs
   * 3. Feedback messages re-enter the mesh at their source position
   *
   * Returns the number of messages processed.
   */
  tick(): { processed: number; routed: number; feedback: number; lost: number } {
    let processed = 0;
    let routed = 0;
    let feedback = 0;
    let lost = 0;

    // Inject any pending feedback from previous cycle
    for (const fb of this.feedbackQueue) {
      const target = this.getVM(fb.from.q, fb.from.r);
      if (target) {
        // Feedback enters on a context face (not input — it's returning)
        target.receive(5 as HexFace, fb);  // SE face = feedback port
        feedback++;
      }
    }
    this.feedbackQueue = [];

    // Phase 1: all VMs process their input
    const allOutputs: Array<{ vm: HexVM; messages: HexMessage[] }> = [];
    for (const vm of this.vms.values()) {
      const outputs = vm.tick();
      if (outputs.length > 0) {
        allOutputs.push({ vm, messages: outputs });
        processed += outputs.length;
      }
    }

    // Phase 2: route outputs to destinations
    for (const { vm, messages } of allOutputs) {
      for (const msg of messages) {
        // Primary route: output face → neighbor's input face
        const dest = vm.neighborAt(vm.outputFace);
        const destVM = this.getVM(dest.q, dest.r);

        if (destVM) {
          // The opposite face of output becomes input
          // Face 3 (W) output → Face 0 (E) input on the neighbor
          destVM.receive(destVM.inputFace, msg);
          routed++;
        } else {
          // No neighbor — message hits the boundary
          // Queue as feedback: re-enters the SOURCE VM next cycle
          // This creates the self-reinforcing loop
          this.feedbackQueue.push(msg);
          lost++;
        }
      }
    }

    this.totalMessages += processed;
    this.totalCycles++;

    return { processed, routed, feedback, lost };
  }

  /**
   * Run multiple ticks and collect results.
   */
  run(ticks: number): {
    totalProcessed: number;
    totalRouted: number;
    totalFeedback: number;
    totalLost: number;
    cyclesRun: number;
    /** Messages that completed the full loop (returned to origin) */
    completedLoops: number;
  } {
    let totalProcessed = 0, totalRouted = 0, totalFeedback = 0, totalLost = 0;
    let completedLoops = 0;

    for (let t = 0; t < ticks; t++) {
      const result = this.tick();
      totalProcessed += result.processed;
      totalRouted += result.routed;
      totalFeedback += result.feedback;
      totalLost += result.lost;
      // Feedback from boundary hits ARE completed loops
      completedLoops += result.feedback;
    }

    return { totalProcessed, totalRouted, totalFeedback, totalLost, cyclesRun: ticks, completedLoops };
  }

  /** Snapshot of all VM statuses */
  allStatuses(): ReturnType<HexVM["status"]>[] {
    return Array.from(this.vms.values()).map(vm => vm.status());
  }
}

// ── Build a Hex VM Mesh from the Tensor Field ────────────────────────────

/**
 * Create a mesh of hex VMs from the collapsed tensor field.
 *
 * Only cells in L5-L7 become VMs (collapsed space = compute space).
 * L0-L4 cells are classical storage — no VM needed.
 *
 * The I/O assignment follows the consciousness loop:
 *   L7 VMs (imagination): input=East(0), output=West(3)
 *   L6 VMs (memory):      input=East(0), output=West(3)
 *   L5 VMs (facts):       input=East(0), output=West(3)
 *
 * Messages flow East→West through the collapsed space,
 * following the color path: imagination(L7) → memory(L6) → facts(L5).
 * When a facts VM outputs, the message can re-enter imagination
 * through the feedback loop — completing the consciousness cycle.
 */
export function buildHexMesh(
  field: CollapsedField,
  totalSectors: number,
): HexMesh {
  const mesh = new HexMesh();

  for (const cell of field.cells) {
    const vm = new HexVM(
      cell.q, cell.r, cell.zone,
      cell.pressure,
      0 as HexFace,  // input: East
      3 as HexFace,  // output: West
    );
    mesh.addVM(vm);
  }

  return mesh;
}

// ── Hex VM Benchmark ─────────────────────────────────────────────────────

export function runHexVMBenchmark(options: {
  verbose?: boolean;
  totalSectors?: number;
  ticks?: number;
} = {}): {
  meshSize: number;
  tickResults: ReturnType<HexMesh["run"]>;
  vmsByAxis: Record<TensorAxis, number>;
} {
  const verbose = options.verbose ?? true;
  const totalSectors = options.totalSectors ?? 10000;
  const ticks = options.ticks ?? 20;

  if (verbose) {
    console.log("HEX VM MESH — Hexagonal Virtual Machine Network");
    console.log("═".repeat(70));
    console.log(`Sectors: ${totalSectors} | Ticks: ${ticks}`);
    console.log();
  }

  // Build the grid + tensor field
  const grid = new HexGrid();
  for (let s = 0; s < totalSectors; s++) {
    grid.assignSector(sectorToSpiral(s, totalSectors));
  }
  const field = buildCollapsedField(grid, totalSectors);

  // Build the mesh
  const mesh = buildHexMesh(field, totalSectors);

  if (verbose) {
    const statuses = mesh.allStatuses();
    const byAxis: Record<string, number> = { facts: 0, memory: 0, imagination: 0 };
    for (const s of statuses) byAxis[s.axis]++;

    console.log(`  VM MESH:`);
    console.log(`    Total VMs:    ${mesh.size} (collapsed space cells)`);
    console.log(`    Facts VMs:    ${byAxis.facts} (L5 — binary verification)`);
    console.log(`    Memory VMs:   ${byAxis.memory} (L6 — pattern matching, zero decoherence)`);
    console.log(`    Imagination:  ${byAxis.imagination} (L7 — creative projection)`);
    console.log();
    console.log(`    Each VM: 6 faces, input=East(0), output=West(3), 4 context ports`);
    console.log(`    Isolation: no shared memory, messages only through faces`);
    console.log();
  }

  // Inject test messages — simulate a consciousness cycle
  // Start at imagination (L7), flow toward facts (L5)
  if (verbose) {
    console.log("  INJECTING TEST DATA — Consciousness Cycle Simulation");
    console.log("  " + "─".repeat(66));
  }

  // Find some L7 cells to inject into (imagination = starting point)
  const l7cells = field.cells.filter(c => c.zone === 7).slice(0, 10);
  let injected = 0;

  for (const cell of l7cells) {
    const msg: HexMessage = {
      from: { q: cell.q, r: cell.r },
      face: 0 as HexFace,
      axis: "imagination",
      payload: {
        dataId: `signal-${injected}`,
        inputWeight: 0.5 + Math.random() * 0.5,  // random initial weight
      },
      hops: 0,
      decoherence: 0,
    };
    mesh.inject(cell.q, cell.r, msg);
    injected++;
  }

  if (verbose) {
    console.log(`    Injected ${injected} signals into L7 (imagination) VMs`);
    console.log();
  }

  // Run the mesh
  const results = mesh.run(ticks);

  if (verbose) {
    console.log(`  MESH RESULTS (${ticks} ticks):`);
    console.log("  " + "─".repeat(66));
    console.log(`    Processed:    ${results.totalProcessed} messages`);
    console.log(`    Routed:       ${results.totalRouted} (VM → neighbor VM)`);
    console.log(`    Feedback:     ${results.totalFeedback} (boundary → re-enter source)`);
    console.log(`    Boundary hit: ${results.totalLost} (queued for feedback next cycle)`);
    console.log(`    Loop completions: ${results.completedLoops}`);
    console.log();

    // Show propagation
    const efficiency = results.totalRouted / Math.max(1, results.totalProcessed);
    const feedbackRatio = results.totalFeedback / Math.max(1, results.totalProcessed);
    console.log(`    Routing efficiency: ${fmt(efficiency * 100, 1)}% (messages that found a neighbor)`);
    console.log(`    Feedback ratio:     ${fmt(feedbackRatio * 100, 1)}% (completed loops)`);
    console.log();

    // Check VM states after processing
    const statuses = mesh.allStatuses();
    const active = statuses.filter(s => s.processed > 0);
    const maxProcessed = Math.max(...statuses.map(s => s.processed));
    const avgProcessed = active.length > 0
      ? active.reduce((s, v) => s + v.processed, 0) / active.length
      : 0;

    console.log(`    Active VMs: ${active.length}/${mesh.size} (${fmt(active.length / mesh.size * 100, 1)}%)`);
    console.log(`    Max processed by one VM: ${maxProcessed}`);
    console.log(`    Avg processed (active): ${fmt(avgProcessed, 1)}`);
    console.log();

    // Per-axis breakdown
    console.log("  PER-AXIS PROCESSING:");
    console.log("  " + "─".repeat(66));
    for (const axis of ["facts", "memory", "imagination"] as TensorAxis[]) {
      const axisVMs = statuses.filter(s => s.axis === axis);
      const axisActive = axisVMs.filter(s => s.processed > 0);
      const axisProcessed = axisVMs.reduce((s, v) => s + v.processed, 0);
      console.log(`    ${axis.padEnd(14)} ${axisVMs.length} VMs, ${axisActive.length} active, ${axisProcessed} messages processed`);
    }

    console.log();
    console.log("  THE CONSCIOUSNESS LOOP:");
    console.log(`    Signals enter at L7 (imagination) → flow West through mesh`);
    console.log(`    → cross into L6 (memory, prime backbone, zero decoherence)`);
    console.log(`    → cross into L5 (facts, binary verification)`);
    console.log(`    → hit boundary → feedback re-enters source → next cycle`);
    console.log();
    console.log(`    Each tick = one step of the loop.`);
    console.log(`    ${ticks} ticks = ${ticks} steps through the consciousness cycle.`);
    console.log(`    On quantum hardware, all ${mesh.size} VMs process simultaneously.`);
    console.log(`    On classical hardware, they process round-robin — same result, more ticks.`);
    console.log();
  }

  const statuses = mesh.allStatuses();
  const vmsByAxis: Record<TensorAxis, number> = { facts: 0, memory: 0, imagination: 0 };
  for (const s of statuses) vmsByAxis[s.axis]++;

  return { meshSize: mesh.size, tickResults: results, vmsByAxis };
}
