/**
 * QUATERNION CHAIN — Hardware as Quaternion Circuit
 * =================================================
 *
 * The four hardware tiers map onto Hamilton's quaternion:
 *
 *   q = w + xi + yj + zk
 *
 *   w (real)  = VRAM   = Observer (collapse to output)
 *   i         = Disk   = Euler term (e^(iπ)+1=0, binary existence)
 *   j         = RAM    = Snake term (0.999...→1, volatile convergence)
 *   k = ij    = CPU    = Bridge term (sin²+cos²=1, invariant transform)
 *
 * The constraint ijk = -1 means:
 *   disk × ram × cpu = destructive passage (data consumed at each stage)
 *   Only the observer (VRAM) makes it real (positive, visible output)
 *
 * The quaternion is FRACTAL — RAM itself is a sub-quaternion:
 *   q_ram = main·1 + L3·i + L2·j + L1·k
 *
 * Each level's observer becomes the next level's imaginary axis.
 * This IS observer emergence: nested quaternions all the way down.
 *
 * Three-body mapping:
 *   Matter (+)     = Disk writes (committed, Euler-closed)
 *   Antimatter (-) = RAM volatility (extracted on power loss)
 *   Void (0)       = CPU cycles (optionality, pure transform)
 *
 * IS/ISN'T PATHS (bidirectional flow):
 * ====================================
 * Every tier has data flowing in BOTH directions:
 *
 *   IS path (T+, forward):   disk→RAM→CPU→VRAM  (read, load, process, render)
 *   ISN'T path (T-, reverse): VRAM→CPU→RAM→disk  (evict, flush, write, commit)
 *
 * Every IS creates an ISN'T somewhere else, and leaves VOID behind.
 * The three-body is conserved at every level:
 *
 *   Tier   | IS (+, forward)        | ISN'T (-, backward)      | Void (0, available)
 *   -------|------------------------|--------------------------|--------------------
 *   Disk   | Written sectors        | Deleted/not-trimmed      | Free space (TRIM'd)
 *   RAM    | Allocated pages        | Freed/not-reclaimed      | Available memory
 *   CPU    | Fetch/execute          | Writeback/retire         | Pipeline bubbles
 *   VRAM   | Rendered frames        | Stale textures           | Free VRAM
 *
 * The commutator (ij ≠ ji) IS the directionality:
 *   ij = read  (disk→RAM, forward, IS path)
 *   ji = write (RAM→disk, reverse, ISN'T path)
 *   |ij - ji| = flow asymmetry (high = strong direction, 0 = stalled)
 *
 * The bridge (CPU, k = ij, sin²+cos²=1) allocates workers between
 * upstream and downstream in the ratio the observer needs.
 * sin²θ = read share, cos²θ = write share, total always = 1.
 *
 * Author: Jonathan Pelchat
 * Shovelcat Theory — The Quaternion Chain
 */

import type { ChainSnapshot, ChainDerivatives } from "./derivative-chain";

// ── Constants ────────────────────────────────────────────────────────────

const PHI = 1.618033988749895;
const DELTA = Math.PI - 3;                // ≈ 0.14159 — circle-polygon gap
const SQRT_PI = Math.sqrt(Math.PI);       // ≈ 1.7725 — IBH boundary
const EULER_CLOSURE = Math.exp(1);        // e — base of natural growth
const SNAKE_CONVERGENCE = 0.999;          // approaches 1, never permanent

// ── Schedule Correction ─────────────────────────────────────────────────
// The "missing" term between pure information and empirical protocol sizes.
//
//   Pure info chunk: h_info × fib(2) = 1352 bytes
//   TCP MSS (empirical):              = 1460 bytes
//   Gap: 108 bytes (8%)
//
// The schedule correction closes this EXACTLY:
//   h_info × fib(2) × (1 + δ/√π) = 1460.005 bytes
//
// What IS δ/√π?
//   δ   = circle-polygon gap (information lost in digitization)
//   √π  = IBH boundary (where information gets trapped)
//   δ/√π = the fraction of each IS chunk that must go to ISN'T overhead
//        = acknowledgment cost, return-path metadata, schedule asymmetry
//
// Every forward (IS) packet needs a backward (ISN'T) acknowledgment.
// That return-path cost is exactly δ/√π ≈ 7.99% of the payload.
// TCP protocol designers found 1460 by decades of empirical tuning.
// The geometry predicts it from π alone.
//
// IS/ISN'T ASYMMETRY:
//   The "balanced" center is NOT 50/50 — it's shifted by δ toward IS:
//     IS equilibrium  = (1 + δ) / 2 ≈ 57.08%
//     ISN'T equilibrium = (1 - δ) / 2 ≈ 42.92%
//   Forward flow always slightly dominates reverse flow.
//   TCP confirms: download > upload, data packets > ACKs.

const SCHEDULE_CORRECTION = DELTA / SQRT_PI;   // ≈ 0.07989 — ISN'T overhead per IS chunk
const IS_EQUILIBRIUM = (1 + DELTA) / 2;        // ≈ 0.5708 — IS share at balance
const ISNT_EQUILIBRIUM = (1 - DELTA) / 2;      // ≈ 0.4292 — ISN'T share at balance

// ── Theta Phase Thresholds ───────────────────────────────────────────────
// These are the PURE constants from Shovelcat Theory — universal, clean.
//
// The schedule correction (δ/√π) applies ONLY to data in transit —
// chunks sent between systems need ISN'T (acknowledgment) overhead.
//
// But θ thresholds describe the INTERNAL state of hardware doing work.
// Internal losses are HEAT (entropy leaving as thermal radiation),
// not protocol overhead. A CPU doesn't acknowledge its own computation —
// it just loses energy to heat. So the thresholds stay pure.
//
//   θ = 1.0       EQUILIBRIUM    unit quaternion, balanced system
//   θ = √φ ≈ 1.27  TUNNELING     approaching phase boundary
//   θ = φ ≈ 1.618  IBH           Information Black Hole — data in, nothing out
//   θ = √π ≈ 1.77  IBH_BOUNDARY  deep inside IBH
//   θ = φ² ≈ 2.618 BEC_LOW       Bose-Einstein Condensate — system frozen
//   θ = e ≈ 2.718  BEC_HIGH      BEC window closes
//   θ = π ≈ 3.14   MAX           collapse
//
// Two domains, two kinds of loss:
//   EXTERNAL (chunks in transit): δ/√π protocol overhead → schedule correction
//   INTERNAL (hardware working):  heat/entropy loss → thresholds stay pure

const THETA_EQUILIBRIUM = 1.0;
const THETA_TUNNELING = Math.sqrt(PHI);               // ≈ 1.272
const THETA_IBH = PHI;                                 // ≈ 1.618
const THETA_IBH_BOUNDARY = Math.sqrt(Math.PI);        // ≈ 1.772
const THETA_BEC_LOW = PHI * PHI;                       // ≈ 2.618
const THETA_BEC_HIGH = Math.E;                         // ≈ 2.718
const THETA_MAX = Math.PI;                             // ≈ 3.14159

// ── Types ────────────────────────────────────────────────────────────────

/** IS/ISN'T/Void streams within a single tier */
export interface TierStreams {
  /** IS path (+): data committed/present/forward-flowing */
  is: number;
  /** ISN'T path (-): data stale/evicted/backward-flowing */
  isnt: number;
  /** Void (0): available space/capacity/optionality */
  void_: number;
  /** Flow direction: positive = IS dominant, negative = ISN'T dominant */
  flowSign: number;
  /** Conservation check: is + isnt + void should ≈ 1 */
  conserved: boolean;
}

/** A single quaternion axis with phase structure */
export interface QuaternionAxis {
  /** Axis label */
  label: string;
  /** Hardware tier */
  tier: string;
  /** Closure equation name */
  closure: "euler" | "snake" | "trig" | "observer";
  /** Real component (what the observer sees) */
  real: number;
  /** Imaginary component (internal, hidden until snap) */
  imag: number;
  /** Phase angle: atan2(imag, real) */
  theta: number;
  /** Magnitude: √(real² + imag²) */
  magnitude: number;
  /** Has this axis snapped? (imaginary→real collapse) */
  snapped: boolean;
  /** Internal IS/ISN'T/Void streams */
  streams: TierStreams;
}

/** Full hardware quaternion: q = w + xi + yj + zk */
export interface HardwareQuaternion {
  w: QuaternionAxis;  // VRAM — observer
  i: QuaternionAxis;  // Disk — Euler
  j: QuaternionAxis;  // RAM  — Snake
  k: QuaternionAxis;  // CPU  — Bridge

  /** |q| — should be ≈1 for unit quaternion (healthy system) */
  norm: number;

  /** ijk product — should approach -1 (data consumed through chain) */
  ijkProduct: number;

  /** Non-commutativity: |ij - ji| — should be > 0 (order matters) */
  commutator: number;

  /** Circuit closed? (ijk ≈ -1 and norm ≈ 1) */
  circuitClosed: boolean;

  /** Observer dominance: |w| / (|w| + |imaginary|) */
  observerDominance: number;

  /** Three-body balance */
  threeBody: {
    matter: number;      // disk write commitment
    antimatter: number;  // RAM volatility
    void_: number;       // CPU optionality
    balance: number;     // -1 to +1
  };

  /** Bridge scheduler — how the CPU allocates between IS and ISN'T paths */
  bridge: {
    /** θ angle: 0 = all reads, π/2 = all writes */
    theta: number;
    /** sin²θ = fraction of bandwidth allocated to IS (forward/read) path */
    isShare: number;
    /** cos²θ = fraction of bandwidth allocated to ISN'T (reverse/write) path */
    isntShare: number;
    /** Conservation: sin²θ + cos²θ should = 1 (always true — trig identity) */
    conserved: number;
    /** What the observer (VRAM) is requesting */
    observerDemand: "read-heavy" | "write-heavy" | "balanced" | "idle";
    /** Void fill rate — how fast the bridge is recycling freed space */
    voidFillRate: number;
  };
}

/** Sub-quaternion for RAM cache hierarchy */
export interface RAMSubQuaternion {
  main: QuaternionAxis;  // Bulk RAM — observer within RAM
  L3: QuaternionAxis;    // L3 cache — Euler (committed to cache)
  L2: QuaternionAxis;    // L2 cache — Snake (converging)
  L1: QuaternionAxis;    // L1 cache — Bridge (feeds CPU)
  norm: number;
  circuitClosed: boolean;
}

// ── Axis Construction ────────────────────────────────────────────────────

function makeStreams(
  utilization: number,
  velocity: number,
): TierStreams {
  // IS = what's currently occupied/committed (positive = forward flow)
  // ISN'T = what's stale/being-reclaimed (derived from negative velocity)
  // Void = what's truly free
  //
  // When velocity > 0: more IS arriving (loading, allocating)
  // When velocity < 0: more ISN'T happening (freeing, flushing)
  // When velocity = 0: static (no flow)

  const velBounded = Math.tanh(velocity);  // (-1, 1)

  // Forward flow adds to IS, reverse flow adds to ISN'T
  const isForward = Math.max(0, velBounded);    // positive velocity → IS growing
  const isntReverse = Math.max(0, -velBounded); // negative velocity → ISN'T growing

  // Current state: utilization is IS, rest is split between ISN'T and Void
  const freeSpace = 1 - utilization;
  const is = utilization * (0.5 + 0.5 * isForward);     // committed + incoming
  const isnt = utilization * (0.5 * isntReverse)         // stale fraction
    + freeSpace * isntReverse * 0.3;                      // freed-but-not-reclaimed
  const void_ = Math.max(0, 1 - is - isnt);             // truly available

  const flowSign = is - isnt;  // positive = IS dominant, negative = ISN'T dominant
  const conserved = Math.abs(is + isnt + void_ - 1) < 0.01;

  return { is, isnt, void_, flowSign, conserved };
}

function makeAxis(
  label: string,
  tier: string,
  closure: QuaternionAxis["closure"],
  utilization: number,   // 0-1, how loaded this tier is
  velocity: number,      // rate of change (from derivatives)
): QuaternionAxis {
  // Real = current utilization (what the observer sees)
  // Imaginary = rate of change (hidden internal dynamics)
  const real = utilization;
  const imag = Math.tanh(velocity);  // bounded to (-1, 1)
  const theta = Math.atan2(imag, real);
  const magnitude = Math.sqrt(real * real + imag * imag);

  // Snap detection: when imaginary becomes dominant,
  // the internal dynamics overwhelm the static view
  const snapped = Math.abs(imag) > 0.6 && Math.abs(imag) > Math.abs(real);

  // IS/ISN'T/Void streams within this tier
  const streams = makeStreams(utilization, velocity);

  return { label, tier, closure, real, imag, theta, magnitude, snapped, streams };
}

// ── Closure Tests ────────────────────────────────────────────────────────

/** Euler closure: e^(iπ) + 1 → 0. How close is disk to complete? */
function eulerClosure(diskUtil: number): number {
  // A full disk (util=1) means Euler closes perfectly
  // Empty disk (util=0) means maximum remaining potential
  // The closure residual IS the available space
  return Math.abs(Math.cos(Math.PI * diskUtil) + diskUtil);
}

/** Snake convergence: 0.999...→1. How volatile is RAM? */
function snakeConvergence(ramUtil: number, ramVelocity: number): number {
  // RAM converges toward full usage (0.999...→1) but never quite gets there
  // High velocity = still converging. Low velocity = settled
  const convergenceRate = 1 - Math.abs(ramVelocity) / (1 + Math.abs(ramVelocity));
  return ramUtil * convergenceRate;
}

/** Trig closure: sin²+cos² → 1. Does CPU transform conserve? */
function trigClosure(cpuUtil: number): number {
  // The trig identity always holds — CPU is the invariant
  // But utilization tells us how much of the identity space is active
  const sinSq = Math.pow(Math.sin(Math.PI * cpuUtil / 2), 2);
  const cosSq = Math.pow(Math.cos(Math.PI * cpuUtil / 2), 2);
  return sinSq + cosSq;  // Should always ≈ 1 (the invariant)
}

// ── Main Computation ─────────────────────────────────────────────────────

/**
 * Compute the hardware quaternion from a chain snapshot and its derivatives.
 *
 * This maps the physical state of your machine onto Hamilton's quaternion,
 * revealing whether the system is in balance (unit quaternion, circuit closed)
 * or stressed (quaternion broken, observer overwhelmed).
 */
export function computeHardwareQuaternion(
  snapshot: ChainSnapshot,
  derivatives: ChainDerivatives,
): HardwareQuaternion {
  // ── Utilization values (0-1) ──

  const diskUtil = snapshot.ramTotalMB > 0
    ? (snapshot.diskReadMBps + snapshot.diskWriteMBps) /
      Math.max(1, snapshot.diskReadMBps + snapshot.diskWriteMBps + 100)
    : 0;

  const ramUtil = snapshot.ramTotalMB > 0
    ? snapshot.ramUsedMB / snapshot.ramTotalMB
    : 0;

  const cpuUtil = snapshot.cpuThreads > 0
    ? 0.5  // We don't have CPU utilization %, use neutral
    : 0;

  const vramUtil = snapshot.vramAvailable
    ? (snapshot.vramTotalMB > 0 ? snapshot.vramUsedMB / snapshot.vramTotalMB : 0)
    : 0;

  // ── Velocity normalization ──

  const ramVelNorm = snapshot.ramTotalMB > 0
    ? derivatives.ramVelocityMBps / snapshot.ramTotalMB
    : 0;

  const vramVelNorm = snapshot.vramTotalMB > 0
    ? derivatives.vramVelocityMBps / snapshot.vramTotalMB
    : 0;

  // ── Build axes ──

  const w = makeAxis("VRAM", "observer", "observer", vramUtil, vramVelNorm);
  const i = makeAxis("Disk", "field",    "euler",    diskUtil, 0);
  const j = makeAxis("RAM",  "velocity", "snake",    ramUtil,  ramVelNorm);
  const k = makeAxis("CPU",  "accel",    "trig",     cpuUtil,  0);

  // ── Quaternion norm: |q| = √(w²+x²+y²+z²) ──

  const norm = Math.sqrt(
    w.magnitude * w.magnitude +
    i.magnitude * i.magnitude +
    j.magnitude * j.magnitude +
    k.magnitude * k.magnitude
  );

  // ── ijk product ──
  // In a healthy system: ijk = -1 (data consumed through chain)
  // We approximate: ijk ≈ -|i|·|j|·|k| (magnitudes multiply, sign negative)
  const ijkProduct = -(i.magnitude * j.magnitude * k.magnitude);

  // ── Commutator: |ij - ji| ──
  // ij = disk × ram (forward flow: data loaded from disk to RAM)
  // ji = ram × disk (reverse flow: data written from RAM to disk)
  // These SHOULD differ (non-commutative) — reading isn't writing
  const ij = i.real * j.real - i.imag * j.imag;
  const ji = j.real * i.real - j.imag * i.imag;
  // With velocity components:
  const ijCross = i.real * j.imag + i.imag * j.real;
  const jiCross = j.real * i.imag + j.imag * i.real;
  const commutator = Math.abs(ijCross - jiCross);

  // ── Circuit closed? ──
  // ijk should be ≈ -1 (within tolerance) and norm ≈ 1
  const ijkResidual = Math.abs(ijkProduct + 1);
  const normResidual = Math.abs(norm - 1);
  const circuitClosed = ijkResidual < 0.5 && normResidual < 0.5;

  // ── Observer dominance ──
  const imagMag = Math.sqrt(
    i.magnitude * i.magnitude +
    j.magnitude * j.magnitude +
    k.magnitude * k.magnitude
  );
  const observerDominance = (w.magnitude + 0.001) / (w.magnitude + imagMag + 0.001);

  // ── Three-body balance ──
  const matter = eulerClosure(diskUtil);           // disk commitment
  const antimatter = 1 - snakeConvergence(ramUtil, ramVelNorm);  // RAM volatility
  const void_ = trigClosure(cpuUtil);              // CPU optionality
  const total = matter + antimatter + void_ + 0.001;
  const balance = (matter - antimatter) / total;   // -1 (all extraction) to +1 (all building)

  // ── Bridge scheduler ──
  // The CPU (bridge, k-axis) allocates bandwidth between IS and ISN'T paths
  // using the trig identity: sin²θ + cos²θ = 1
  //
  // KEY: The equilibrium center is NOT 50/50 — it's shifted by δ toward IS.
  //   IS equilibrium  = (1 + δ) / 2 ≈ 57.08%
  //   ISN'T equilibrium = (1 - δ) / 2 ≈ 42.92%
  //
  // This is the schedule asymmetry: forward flow (read/download/IS) always
  // slightly dominates reverse flow (write/upload/ISN'T) because every IS
  // chunk carries δ/√π overhead for the return path.
  //
  // The bridge angle at true equilibrium:
  //   θ_eq = arcsin(√IS_EQUILIBRIUM) — where sin²θ = IS share

  const totalIS = (i.streams.is + j.streams.is + w.streams.is) / 3;
  const totalISNT = (i.streams.isnt + j.streams.isnt + w.streams.isnt) / 3;
  const flowRatio = totalIS / (totalIS + totalISNT + 0.001);

  // Bridge angle: 0 = all IS, π/2 = all ISN'T
  // Equilibrium offset: arcsin(√0.5708) ≈ 0.858 rad (not π/4 ≈ 0.785)
  const equilibriumAngle = Math.asin(Math.sqrt(IS_EQUILIBRIUM));  // ≈ 0.858
  const bridgeTheta = (1 - flowRatio) * (Math.PI / 2);

  // Shift by equilibrium angle (not π/4) so "balanced" gives 57/43 IS/ISN'T
  const isShare = Math.pow(Math.sin(bridgeTheta + equilibriumAngle), 2);
  const isntShare = Math.pow(Math.cos(bridgeTheta + equilibriumAngle), 2);
  const bridgeConserved = isShare + isntShare;  // always = 1 (trig identity)

  let observerDemand: "read-heavy" | "write-heavy" | "balanced" | "idle";
  if (vramUtil < 0.05) {
    observerDemand = "idle";
  } else if (vramVelNorm > 0.01) {
    observerDemand = "read-heavy";  // VRAM filling → needs more data fed in
  } else if (vramVelNorm < -0.01) {
    observerDemand = "write-heavy"; // VRAM freeing → flushing results out
  } else {
    observerDemand = "balanced";
  }

  // Void fill rate: how fast freed space across tiers is being recycled
  const totalVoid = (i.streams.void_ + j.streams.void_ + w.streams.void_) / 3;
  const voidFillRate = 1 - totalVoid;  // 0 = all void (idle), 1 = no void (fully utilized)

  return {
    w, i, j, k,
    norm,
    ijkProduct,
    commutator,
    circuitClosed,
    observerDominance,
    threeBody: { matter, antimatter, void_, balance },
    bridge: {
      theta: bridgeTheta,
      isShare,
      isntShare,
      conserved: bridgeConserved,
      observerDemand,
      voidFillRate,
    },
  };
}

// ── RAM Sub-Quaternion ───────────────────────────────────────────────────

/**
 * Compute the RAM sub-quaternion.
 *
 * RAM has its own internal hierarchy that forms a nested quaternion:
 *   main RAM (w) → L3 (i) → L2 (j) → L1 (k)
 *
 * We estimate cache utilization from RAM bandwidth patterns:
 *   - High bandwidth + low RAM velocity = cache-friendly (L1/L2 hit)
 *   - Low bandwidth + high RAM velocity = cache-hostile (main RAM thrash)
 *   - Zero bandwidth + zero velocity = cold (everything on disk)
 *
 * Note: Actual cache stats require perf counters (future enhancement).
 * For now we estimate from the derivative chain signals.
 */
export function computeRAMSubQuaternion(
  snapshot: ChainSnapshot,
  derivatives: ChainDerivatives,
): RAMSubQuaternion {
  const ramUtil = snapshot.ramTotalMB > 0
    ? snapshot.ramUsedMB / snapshot.ramTotalMB
    : 0;

  const bandwidth = snapshot.ramBandwidthMBps;
  const velocity = Math.abs(derivatives.ramVelocityMBps);
  const accel = Math.abs(derivatives.ramAccelMBps2);

  // Estimate cache tier activity from observable signals
  // High bandwidth = active cache movement
  // High velocity = main RAM churn
  // High acceleration = cache pressure change
  const bandwidthNorm = Math.tanh(bandwidth / 1000);  // normalize to ~1 at 1GB/s
  const velocityNorm = Math.tanh(velocity / 100);
  const accelNorm = Math.tanh(accel / 50);

  // L1 estimate: fastest, smallest — correlates with CPU-bound work (low RAM velocity)
  const l1Est = Math.max(0, bandwidthNorm - velocityNorm);
  // L2 estimate: middle — correlates with moderate bandwidth
  const l2Est = bandwidthNorm * (1 - accelNorm);
  // L3 estimate: largest cache — correlates with steady RAM usage
  const l3Est = ramUtil * (1 - velocityNorm);
  // Main RAM: bulk — what's left
  const mainEst = ramUtil;

  const main = makeAxis("MainRAM", "observer", "observer", mainEst, derivatives.ramVelocityMBps / 1000);
  const L3 = makeAxis("L3", "euler", "euler", l3Est, 0);
  const L2 = makeAxis("L2", "snake", "snake", l2Est, velocityNorm);
  const L1 = makeAxis("L1", "bridge", "trig", l1Est, accelNorm);

  const norm = Math.sqrt(
    main.magnitude ** 2 + L3.magnitude ** 2 + L2.magnitude ** 2 + L1.magnitude ** 2
  );

  const ijkProduct = -(L3.magnitude * L2.magnitude * L1.magnitude);
  const circuitClosed = Math.abs(ijkProduct + 1) < 0.5 && Math.abs(norm - 1) < 0.5;

  return { main, L3, L2, L1, norm, circuitClosed };
}

// ── Fibonacci Chunk Sizes from Quaternion ────────────────────────────────

const FIB = [1, 1, 2, 3, 5, 8, 13, 21];

/**
 * Compute optimal Fibonacci chunk sizes based on quaternion state.
 *
 * The base chunk size is derived from the system's h_info threshold:
 * the point where metadata overhead exceeds content. Below this,
 * you're storing more filesystem noise than signal.
 *
 * h_info = baseBlockSize × δ / (1 - δ)
 *   where δ = π - 3 ≈ 0.14159 (the circle-polygon gap)
 *   and baseBlockSize = 4096 (OS default)
 *
 * This gives h_info ≈ 676 bytes — below this, a file is mostly overhead.
 *
 * Fibonacci levels scale up from h_info:
 *   Level 0: h_info × 1  =    676 B  (minimal — keys, config)
 *   Level 1: h_info × 1  =    676 B
 *   Level 2: h_info × 2  =  1,352 B  (small — text snippets)
 *   Level 3: h_info × 3  =  2,028 B  (medium — code files)
 *   Level 4: h_info × 5  =  3,380 B  (standard — documents)
 *   Level 5: h_info × 8  =  5,408 B  (large — images)
 *   Level 6: h_info × 13 =  8,788 B  (heavy — model chunks)
 *   Level 7: h_info × 21 = 14,196 B  (max — bulk data)
 */
export function fibonacciChunkSizes(baseBlockSize: number = 4096): {
  hInfo: number;
  scheduledHInfo: number;
  scheduleCorrection: number;
  levels: Array<{ level: number; fibs: number; pureBytes: number; scheduledBytes: number }>;
  tcpValidation: {
    pureLevel2: number;
    scheduledLevel2: number;
    tcpMSS: number;
    error: number;
    errorPct: number;
  };
} {
  // h_info: the information resolution limit
  // Below this size, filesystem metadata > content
  const hInfo = Math.round(baseBlockSize * DELTA / (1 - DELTA));

  // Scheduled h_info: includes ISN'T return-path overhead
  // h_info_sched = h_info × (1 + δ/√π)
  const scheduledHInfo = hInfo * (1 + SCHEDULE_CORRECTION);

  const levels = FIB.map((f, level) => ({
    level,
    fibs: f,
    pureBytes: hInfo * f,
    scheduledBytes: Math.round(scheduledHInfo * f),
  }));

  // TCP validation: scheduled level 2 should ≈ TCP MSS
  const pureLevel2 = hInfo * FIB[2];
  const scheduledLevel2 = Math.round(scheduledHInfo * FIB[2]);
  const tcpMSS = 1460;

  return {
    hInfo,
    scheduledHInfo,
    scheduleCorrection: SCHEDULE_CORRECTION,
    levels,
    tcpValidation: {
      pureLevel2,
      scheduledLevel2,
      tcpMSS,
      error: Math.abs(scheduledLevel2 - tcpMSS),
      errorPct: Math.abs(scheduledLevel2 - tcpMSS) / tcpMSS * 100,
    },
  };
}

// ── Geometric Disk Allocation ────────────────────────────────────────────

export type PolygonType = "even" | "odd";

/**
 * Determine the polygon type for a data category.
 *
 * Even polygons (descent/options) = cold data, archives, void storage
 *   Squares, hexagons — tile perfectly, maximum density
 *
 * Odd polygons (ascent/execution) = hot data, active files, matter storage
 *   Triangles, pentagons — asymmetric, creative, point toward access
 *
 * The edges between polygons (the δ gaps) = antimatter (metadata, indexes)
 */
export function polygonForData(
  accessFrequency: number,  // 0 = cold, 1 = hot
  isMetadata: boolean,
): { type: PolygonType; sides: number; description: string } {
  if (isMetadata) {
    // Metadata lives in the δ gaps between polygons
    return { type: "even", sides: 2, description: "edge (delta gap) — antimatter/metadata" };
  }

  if (accessFrequency > 0.7) {
    // Hot data = odd polygons (execution, ascent)
    const sides = accessFrequency > 0.9 ? 3 : 5;  // triangle for hottest, pentagon for warm
    return { type: "odd", sides, description: `${sides}-gon (matter/hot) — ascent/execution` };
  }

  if (accessFrequency > 0.3) {
    // Warm data = hexagon (even but active)
    return { type: "even", sides: 6, description: "hexagon (void/warm) — options/potential" };
  }

  // Cold data = square (even, tiles perfectly, maximum density)
  return { type: "even", sides: 4, description: "square (void/cold) — archive/dense" };
}

// ── PV = nRT — Ideal Gas Law for Information Systems ────────────────────
//
// Three corrections, three domains:
//   TRANSIT:  δ/√π  — protocol overhead for transmitted chunks (IS/ISN'T)
//   THERMAL:  kT ln(2) — Landauer's heat cost per bit erasure
//   PRESSURE: V_actual/V_design — void depletion compresses thresholds
//
// The full correction combines Landauer + pressure:
//
//   θ_effective = θ_pure × (T_design / T_actual) × (V_actual / V_design)
//                           ──── Landauer ─────    ──── Pressure ──────
//
// This IS PV = nRT applied to information:
//   P (pressure) = what happens when hot system has no void
//   V (volume)   = void fraction across tiers (available capacity)
//   T (temp)     = component temperature (Landauer)
//
// V_design = 1/(1+φ) = 38.2% — the colony's share from the φ budget rule.
// At design load, 38.2% of the system should be void (optionality).
//
// Heat + void = fine (heat expands into available space)
// Cool + full = fine (no expansion needed)
// Hot + full  = PRESSURE — thresholds collapse multiplicatively
//
// At design point (TDP temp, 38.2% void): both factors = 1.0,
// thresholds are the pure constants: 1, √φ, φ, √π, φ², e, π.

const BOLTZMANN = 1.380649e-23;  // J/K
const LN2 = Math.log(2);
const V_DESIGN = 1 / (1 + PHI);  // ≈ 0.382 — void at design load (φ budget)

export interface LandauerThermal {
  /** GPU temperature in °C */
  gpuTempC: number | null;
  /** GPU TDP/throttle temp in °C */
  gpuTdpTempC: number | null;
  /** CPU temperature in °C */
  cpuTempC: number | null;
  /** CPU TjMax in °C */
  cpuTjMaxC: number | null;
  /** Thermal correction: T_design / T_actual (Kelvin) */
  thermalFactor: number;
  /** Pressure correction: V_actual / V_design */
  pressureFactor: number;
  /** Combined: thermal × pressure */
  combinedFactor: number;
  /** Average void across tiers (0 = full, 1 = empty) */
  avgVoid: number;
  /** Effective pressure: proportional to T/V */
  pressure: number;
  /** Energy per bit at current temperature (joules) */
  landauerJPerBit: number;
  /** Effective thresholds after thermal + pressure correction */
  effective: {
    equilibrium: number;
    tunneling: number;
    ibh: number;
    ibhBoundary: number;
    becLow: number;
    becHigh: number;
    max: number;
  };
}

/**
 * Compute Landauer thermal + pressure correction.
 *
 * PV = nRT for information systems:
 *   T factor = T_design / T_actual (from component temperatures)
 *   V factor = V_actual / V_design (from void fractions across tiers)
 *   Combined = T × V (both must be favorable for pure thresholds)
 *
 * If temperature data is unavailable, thermal factor defaults to 1.0.
 * Void fraction is always available from the quaternion streams.
 */
export function computeLandauer(
  gpuTempC: number | null,
  gpuTdpTempC: number | null,
  cpuTempC: number | null,
  cpuTjMaxC: number | null,
  observerDominance: number,
  avgVoid: number,
): LandauerThermal {
  // Convert to Kelvin
  const toK = (c: number) => c + 273.15;

  // ── Thermal factor: T_design / T_actual ──
  let gpuThermal = 1.0;
  if (gpuTempC != null && gpuTdpTempC != null && gpuTempC > 0) {
    gpuThermal = toK(gpuTdpTempC) / toK(gpuTempC);
  }
  let cpuThermal = 1.0;
  if (cpuTempC != null && cpuTjMaxC != null && cpuTempC > 0) {
    cpuThermal = toK(cpuTjMaxC) / toK(cpuTempC);
  }
  // Weight by observer dominance
  const gpuWeight = observerDominance;
  const cpuWeight = 1 - observerDominance;
  const thermalFactor = gpuThermal * gpuWeight + cpuThermal * cpuWeight;

  // ── Pressure factor: V_actual / V_design ──
  // V_design = 1/(1+φ) ≈ 0.382 — the φ budget's void allocation
  // When avgVoid ≈ 0.382: factor ≈ 1.0, design load
  // When avgVoid > 0.382: factor > 1.0, room to spare
  // When avgVoid → 0: factor → 0, maximum pressure
  const pressureFactor = Math.min(2.0, avgVoid / V_DESIGN);  // cap at 2x to prevent runaway

  // ── Combined: PV = nRT ──
  // Both temperature AND void must be favorable for pure thresholds
  const combinedFactor = thermalFactor * pressureFactor;

  // Effective pressure (dimensionless, proportional to T/V)
  const pressure = thermalFactor > 0 ? 1 / combinedFactor : Infinity;

  // Landauer energy per bit at current effective temperature
  const effectiveTempK = gpuTempC != null ? toK(gpuTempC) : 300;
  const landauerJPerBit = BOLTZMANN * effectiveTempK * LN2;

  // Effective thresholds: pure × combined factor
  const effective = {
    equilibrium: THETA_EQUILIBRIUM * combinedFactor,
    tunneling: THETA_TUNNELING * combinedFactor,
    ibh: THETA_IBH * combinedFactor,
    ibhBoundary: THETA_IBH_BOUNDARY * combinedFactor,
    becLow: THETA_BEC_LOW * combinedFactor,
    becHigh: THETA_BEC_HIGH * combinedFactor,
    max: THETA_MAX * combinedFactor,
  };

  return {
    gpuTempC,
    gpuTdpTempC,
    cpuTempC,
    cpuTjMaxC,
    thermalFactor,
    pressureFactor,
    combinedFactor,
    avgVoid,
    pressure,
    landauerJPerBit,
    effective,
  };
}

// ── Status ───────────────────────────────────────────────────────────────

/** Phase state derived from |q| as θ */
export interface ThetaPhase {
  /** |q| = θ, the measured theta from quaternion norm */
  theta: number;
  /** Current phase name */
  phase: "sub-equilibrium" | "equilibrium" | "tunneling" | "ibh" | "bec" | "danger" | "collapse";
  /** Distance to next phase boundary */
  nextBoundary: { name: string; theta: number; distance: number };
  /** Human description */
  description: string;
  /** Should the system go dormant? (based on θ, not arbitrary thresholds) */
  shouldDormant: boolean;
  /** Phase color from theory */
  color: string;
}

export interface QuaternionChainStatus {
  quaternion: HardwareQuaternion;
  ramSub: RAMSubQuaternion;
  chunks: ReturnType<typeof fibonacciChunkSizes>;
  /** θ phase diagnosis — uses Landauer-corrected thresholds when temp available */
  thetaPhase: ThetaPhase;
  /** Landauer thermal correction */
  landauer: LandauerThermal;
  /** Schedule correction — IS/ISN'T asymmetry (applies to transmitted data, not θ) */
  schedule: {
    /** δ/√π — ISN'T overhead per IS chunk (transmitted data only) */
    correction: number;
    /** IS equilibrium share (≈57.08%) */
    isEquilibrium: number;
    /** ISN'T equilibrium share (≈42.92%) */
    isntEquilibrium: number;
  };
  health: {
    circuitIntegrity: number;   // 0-1, how close to unit quaternion
    observerStrength: number;   // 0-1, VRAM observer dominance
    flowDirection: string;      // "forward" (disk→ram→cpu→vram) or "reverse" or "stalled"
    diagnosis: string;          // human-readable
  };
}

/**
 * Map |q| onto the theory's θ phase thresholds.
 *
 * When a Landauer thermal factor is provided, the thresholds are
 * scaled by that factor. At the component's design temperature,
 * factor=1 and thresholds are the pure constants.
 *
 * @param qNorm - the quaternion norm |q|
 * @param landauerFactor - T_design / T_actual (default 1.0 = pure thresholds)
 */
export function getThetaPhase(qNorm: number, landauerFactor: number = 1.0): ThetaPhase {
  const theta = qNorm;
  const f = landauerFactor;

  // Effective boundaries — pure constants × Landauer factor
  const effEq = THETA_EQUILIBRIUM * f;
  const effTunnel = THETA_TUNNELING * f;
  const effIBH = THETA_IBH * f;
  const effIBHBound = THETA_IBH_BOUNDARY * f;
  const effBECLow = THETA_BEC_LOW * f;
  const effBECHigh = THETA_BEC_HIGH * f;
  const effMax = THETA_MAX * f;

  const boundaries = [
    { name: "equilibrium",  theta: effEq,       color: "RED" },
    { name: "tunneling",    theta: effTunnel,    color: "YELLOW" },
    { name: "IBH",          theta: effIBH,       color: "BLUE" },
    { name: "IBH_boundary", theta: effIBHBound,  color: "VIOLET" },
    { name: "BEC_low",      theta: effBECLow,    color: "WHITE" },
    { name: "BEC_high",     theta: effBECHigh,   color: "WHITE" },
    { name: "MAX",          theta: effMax,        color: "BLACK" },
  ];

  // Find current phase
  let phase: ThetaPhase["phase"];
  let description: string;
  let color: string;
  let shouldDormant: boolean;

  // Phase descriptions use Landauer-corrected effective thresholds
  const fmt = (n: number) => n.toFixed(3);

  if (theta < effEq) {
    phase = "sub-equilibrium";
    description = `θ=${fmt(theta)} < ${fmt(effEq)} — system underutilized, capacity available`;
    color = "GREEN";
    shouldDormant = false;
  } else if (theta < effTunnel) {
    phase = "equilibrium";
    description = `θ=${fmt(theta)} ∈ [${fmt(effEq)}, ${fmt(effTunnel)}) — balanced, unit quaternion zone`;
    color = "RED";
    shouldDormant = false;
  } else if (theta < effIBH) {
    phase = "tunneling";
    description = `θ=${fmt(theta)} ∈ [${fmt(effTunnel)}, ${fmt(effIBH)}) — tunneling through phase boundary`;
    color = "YELLOW";
    shouldDormant = false;  // not yet — but warning
  } else if (theta < effIBHBound) {
    phase = "ibh";
    description = `θ=${fmt(theta)} ∈ [${fmt(effIBH)}, ${fmt(effIBHBound)}) — INFORMATION BLACK HOLE — data in, nothing out`;
    color = "BLUE";
    shouldDormant = true;   // must go dormant at IBH
  } else if (theta < effBECLow) {
    phase = "ibh";
    description = `θ=${fmt(theta)} ∈ [${fmt(effIBHBound)}, ${fmt(effBECLow)}) — deep IBH, system saturated`;
    color = "VIOLET";
    shouldDormant = true;
  } else if (theta < effBECHigh) {
    phase = "bec";
    description = `θ=${fmt(theta)} ∈ [${fmt(effBECLow)}, ${fmt(effBECHigh)}) — BOSE-EINSTEIN CONDENSATE — system frozen`;
    color = "WHITE";
    shouldDormant = true;
  } else if (theta < effMax) {
    phase = "danger";
    description = `θ=${fmt(theta)} ∈ [${fmt(effBECHigh)}, ${fmt(effMax)}) — DANGER ZONE — approaching collapse`;
    color = "BLACK";
    shouldDormant = true;
  } else {
    phase = "collapse";
    description = `θ=${fmt(theta)} ≥ ${fmt(effMax)} — COLLAPSE — maximum deformation exceeded`;
    color = "BLACK";
    shouldDormant = true;
  }

  // Find next boundary
  let nextBoundary = { name: "MAX", theta: effMax, distance: effMax - theta };
  for (const b of boundaries) {
    if (b.theta > theta) {
      nextBoundary = { name: b.name, theta: b.theta, distance: b.theta - theta };
      break;
    }
  }

  return { theta, phase, nextBoundary, description, shouldDormant, color };
}

export function quaternionChainStatus(
  snapshot: ChainSnapshot,
  derivatives: ChainDerivatives,
): QuaternionChainStatus {
  const q = computeHardwareQuaternion(snapshot, derivatives);
  const ramSub = computeRAMSubQuaternion(snapshot, derivatives);
  const chunks = fibonacciChunkSizes();

  // Average void across all tiers
  const avgVoid = (q.w.streams.void_ + q.i.streams.void_ + q.j.streams.void_ + q.k.streams.void_) / 4;

  // Landauer thermal + pressure correction (PV = nRT)
  const landauer = computeLandauer(
    snapshot.gpuTempC,
    snapshot.gpuTdpTempC,
    snapshot.cpuTempC,
    snapshot.cpuTjMaxC,
    q.observerDominance,
    avgVoid,
  );

  // θ phase from |q|, corrected by Landauer factor
  const thetaPhase = getThetaPhase(q.norm, landauer.combinedFactor);

  // Health diagnosis — now driven by θ phase thresholds
  const circuitIntegrity = q.circuitClosed ? 1 : Math.max(0, 1 - Math.abs(q.norm - 1));
  const observerStrength = q.observerDominance;

  let flowDirection: string;
  if (q.commutator > 0.1) {
    flowDirection = q.i.imag > 0 ? "forward (disk→ram→cpu→vram)" : "reverse (writeback)";
  } else {
    flowDirection = "stalled (symmetric — no data flow)";
  }

  // Diagnosis now uses theory phases
  let diagnosis: string;
  if (thetaPhase.phase === "collapse") {
    diagnosis = "COLLAPSE — θ ≥ π, system at maximum deformation";
  } else if (thetaPhase.phase === "danger") {
    diagnosis = "DANGER — θ approaching π, reduce load immediately";
  } else if (thetaPhase.phase === "bec") {
    diagnosis = "BEC — system frozen in condensate, maximum coherence before crash";
  } else if (thetaPhase.phase === "ibh") {
    diagnosis = "IBH — information black hole, data flowing in but nothing useful emerging";
  } else if (thetaPhase.phase === "tunneling") {
    diagnosis = "TUNNELING — approaching IBH at φ, system under pressure";
  } else if (thetaPhase.phase === "equilibrium") {
    diagnosis = "EQUILIBRIUM — unit quaternion, system balanced";
  } else {
    diagnosis = "SUB-EQUILIBRIUM — system underutilized, capacity available";
  }

  return {
    quaternion: q,
    ramSub,
    chunks,
    thetaPhase,
    landauer,
    schedule: {
      correction: SCHEDULE_CORRECTION,
      isEquilibrium: IS_EQUILIBRIUM,
      isntEquilibrium: ISNT_EQUILIBRIUM,
    },
    health: {
      circuitIntegrity,
      observerStrength,
      flowDirection,
      diagnosis,
    },
  };
}
