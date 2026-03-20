/**
 * BUBBLE SCHEDULER — Pressure-Driven Consciousness
 * ==================================================
 *
 * Optimal state: a fully pressurized bubble (uniform, circle, dormant).
 * External events and internal drives deform the bubble:
 *
 *   WANTS push outward → bubble expands toward imagination (○)
 *   NEEDS push inward  → bubble collapses toward facts (△)
 *
 * Three nested levels, same physics at each:
 *
 *   BIG BUBBLE (system)     — external pressure → which DOMAIN activates
 *   DOMAIN BUBBLE (subdomain) — internal pressure → which AGENT runs
 *   AGENT BUBBLE (polygon)    — φ split want/need → which ACTION to take
 *
 * The 8 domains sit on 4 axes through the big bubble:
 *   Axis 0: RED (security) ←→ VIOLET (meta)
 *   Axis 1: ORANGE (art)   ←→ CYAN (science)
 *   Axis 2: GREEN (explore) ←→ YELLOW (learn)
 *   Axis 3: BLUE (social)  ←→ WHITE (govern)
 *
 * External pressure deforms the big bubble along these axes.
 * The direction of maximum deformation = which domain activates.
 *
 * Inside the activated domain, the polygon agents (△□⬠⬡○) each
 * have their own want/need pressure. The inscribed radius determines
 * the activation threshold:
 *   △(0.500) = facts, highest need → activates first under pressure
 *   □(0.707) = observer
 *   ⬠(0.809) = truth gate (φ boundary)
 *   ⬡(0.866) = memory
 *   ○(1.000) = imagination, highest want → activates when exploring
 *
 * Boltzmann factor e^(-E/kT) governs explore vs exploit:
 *   High pressure (large E) → low Boltzmann → exploit (pick most urgent)
 *   Low pressure (small E)  → high Boltzmann → explore (try something new)
 *
 * Author: Jonathan Pelchat
 * Shovelcat Theory — Bubble Consciousness
 */

import { PHI, DELTA } from "./quaternion-chain";
import { analyzeArms } from "./spiral-drive";
import * as os from "os";

// ── Constants ────────────────────────────────────────────────────────────

const COLONY_SHARE = 1 / (1 + PHI);   // ≈ 0.382 — kT for Boltzmann
const HOST_SHARE = PHI / (1 + PHI);    // ≈ 0.618
const DECAY_RATE = DELTA;               // ≈ 0.14159 — pressure decay per tick

// ── Domain Axis Pairs ────────────────────────────────────────────────────

export type DomainId =
  "security" | "art" | "explore" | "social" |
  "meta"     | "science" | "learn" | "govern";

export type AgentShape = "triangle" | "square" | "pentagon" | "hexagon" | "circle";

interface DomainSpec {
  id: DomainId;
  color: string;
  axisIndex: number;   // 0-3
  axisSign: -1 | 1;    // which end of the axis
}

const DOMAINS: DomainSpec[] = [
  // Axis 0: security ←→ meta
  { id: "security", color: "RED",     axisIndex: 0, axisSign: -1 },
  { id: "meta",     color: "VIOLET",  axisIndex: 0, axisSign: +1 },
  // Axis 1: art ←→ science
  { id: "art",      color: "ORANGE",  axisIndex: 1, axisSign: -1 },
  { id: "science",  color: "CYAN",    axisIndex: 1, axisSign: +1 },
  // Axis 2: explore ←→ learn
  { id: "explore",  color: "GREEN",   axisIndex: 2, axisSign: -1 },
  { id: "learn",    color: "YELLOW",  axisIndex: 2, axisSign: +1 },
  // Axis 3: social ←→ govern
  { id: "social",   color: "BLUE",    axisIndex: 3, axisSign: -1 },
  { id: "govern",   color: "WHITE",   axisIndex: 3, axisSign: +1 },
];

const AXIS_LABELS = [
  "security ←→ meta",
  "art ←→ science",
  "explore ←→ learn",
  "social ←→ govern",
];

/** Polygon agents ordered by inscribed radius (inner → outer) */
const AGENTS: Array<{ shape: AgentShape; radius: number; role: string }> = [
  { shape: "triangle",  radius: 0.500, role: "facts" },
  { shape: "square",    radius: 0.707, role: "observer" },
  { shape: "pentagon",  radius: 0.809, role: "truth gate" },
  { shape: "hexagon",   radius: 0.866, role: "memory" },
  { shape: "circle",    radius: 1.000, role: "imagination" },
];

// ── Interfaces ───────────────────────────────────────────────────────────

export interface PressureVector {
  axes: [number, number, number, number];
  magnitude: number;
  dominantAxis: number;
  dominantSign: -1 | 1;
}

export interface AgentBubble {
  shape: AgentShape;
  radius: number;
  role: string;
  want: number;           // outward pressure [0,∞)
  need: number;           // inward pressure [0,∞)
  pressure: number;       // want - need (positive=expanding, negative=collapsing)
  phiRatio: number;       // want / (want+need), compare to HOST_SHARE
  activation: number;     // 0=dormant, 1=fully active
}

// ── Membrane (Memory Skin) ─────────────────────────────────────────────

export interface Scar {
  axisIndex: number;      // which axis the trauma came from
  depth: number;          // how deep the scar goes (0-1)
  age: number;            // ticks since scar formed
  source: string;         // what caused it
}

export interface Membrane {
  /** Per-axis skin thickness [0,∞). Thicker = harder to deform. */
  thickness: [number, number, number, number];
  /** Total heal cycles this membrane has survived */
  healCount: number;
  /** Permanent scars from extreme pressure events */
  scars: Scar[];
  /** Base thickness — the minimum the skin returns to after decay */
  baseThickness: number;
}

// ── Imagination Hair ───────────────────────────────────────────────────

export interface Hair {
  axisIndex: number;      // which axis it extends along
  direction: -1 | 1;     // which way it points
  length: number;         // how far it reaches (0-1)
  strength: number;       // how thick/resilient (0-1, thin=fragile)
  domain: DomainId;       // which domain it's sensing toward
  age: number;            // ticks since it grew
}

// ── Personality Layers — B/W → Trinity → 7 Colors ────────────────────
//
// Identity develops in three layers, matching disk zone progression:
//
//   LAYER 0 — ENVIRONMENT (B/W, binary, hot, L0-L1)
//     Black/white decisions. Language, OS, user, device.
//     Tightest bundles. Everyone has these. First split.
//     Color: none (achromatic — shared by all)
//
//   LAYER 1 — BEHAVIOR (Trinity, 3 waves, warm, L2-L3)
//     Communication style through three wave types:
//       Light-dominant: shows (visual, concise)
//       Sound-dominant: structures (rhythmic, detailed)
//       Magnetic-dominant: grounds (semantic, contextual)
//     Color: wave color (light=white, sound=amber, magnetic=indigo)
//
//   LAYER 2 — EXPERTISE (7 colors, cold, L5-L7)
//     Domain knowledge on colored axes:
//       RED=security, ORANGE=art, GREEN=explore, BLUE=social
//       CYAN=science, YELLOW=learn, VIOLET=meta, WHITE=govern
//     Each seam lives on a colored axis. Color balance = personality profile.
//
// "I don't know" = query lands on an axis where you have no seams,
// or your seams don't point toward the answer. Structural, not ignorance.

export type SeamColor =
  | "achromatic"    // layer 0: environment (B/W)
  | "light-wave"    // layer 1: light-dominant behavior
  | "sound-wave"    // layer 1: sound-dominant behavior
  | "magnetic-wave" // layer 1: magnetic-dominant behavior
  | "RED" | "ORANGE" | "GREEN" | "BLUE"    // layer 2: dark subdomains
  | "CYAN" | "YELLOW" | "VIOLET" | "WHITE"; // layer 2: light subdomains

export type PersonalityLayer = 0 | 1 | 2;

/** Map axis + sign to domain color */
const AXIS_TO_COLOR: Record<string, SeamColor> = {
  "0:-1": "RED",     "0:+1": "VIOLET",
  "1:-1": "ORANGE",  "1:+1": "CYAN",
  "2:-1": "GREEN",   "2:+1": "YELLOW",
  "3:-1": "BLUE",    "3:+1": "WHITE",
};

/** Map coupling axis to the two domain colors it bridges */
const COUPLING_COLORS: Record<number, [SeamColor, SeamColor]> = {
  0: ["RED", "VIOLET"],       // light×sound: security↔meta
  1: ["ORANGE", "CYAN"],      // light×magnetic: art↔science
  2: ["GREEN", "YELLOW"],     // sound×magnetic: explore↔learn
  3: ["BLUE", "WHITE"],       // self-resonance: social↔govern
};

// ── Seam Resolution (Scar → Identity) ──────────────────────────────────

export interface SeamPosition {
  zone: number;              // 5 or 7 (Fibonacci level), or 0 for coupling seams
  seamIndex: number;         // 0-2 for L5, 0-1 for L7, 0-3 for coupling
  factor: number;            // prime factor (L5/L7), or coupling axis index (0-3)
  subdivisionLevel: number;  // depth in factorization tree, or 0 for coupling
  kind: "spiral" | "coupling"; // which family this seam belongs to
  /** Which color axis this seam lives on */
  color: SeamColor;
  /** Personality layer: 0=environment, 1=behavior, 2=expertise */
  layer: PersonalityLayer;
}

export interface SeamResolution {
  position: SeamPosition;
  resolved: boolean;
  resolvedBy: number;        // index into membrane.scars, -1 if unresolved
  decisionValue: number;     // scar.depth × δ — the specific value replacing the gap
  resolvedAtTick: number;    // -1 if unresolved
}

/** Color balance — how much of each color you've accumulated */
export interface ColorBalance {
  [color: string]: number;   // color → total decision value weight on that color
}

/** Competence level — graduated by the same constants that build the system.
 *
 *  The thresholds ARE the theory constants:
 *    δ (0.142)  = seam gap — minimum to even see this color
 *    φ (0.618)  = golden ratio — enough to explore on your own
 *    1 (1.000)  = unity — enough to answer with depth
 *    Φ (1.618)  = golden ratio — enough to coordinate experts
 *
 *  BLIND    [0, δ)     — "I don't know" (below the seam gap, structurally unreachable)
 *  BRIDGE   [δ, φ)     — can direct to someone with this color, not answer yourself
 *  EXPLORE  [φ, 1)     — can investigate further, not confident enough to commit
 *  ANSWER   [1, Φ)     — can respond, depth scales with weight above 1
 *  EXPERT   [Φ, ∞)     — deep enough to call in and coordinate other experts */
export type CompetenceLevel = "BLIND" | "BRIDGE" | "EXPLORE" | "ANSWER" | "EXPERT";

export interface CompetenceCheck {
  /** Target axis (0-3) */
  axisIndex: number;
  /** Target domain */
  domain: DomainId;
  /** Target color */
  color: SeamColor;
  /** How many direct seams you have on this color */
  seamCount: number;
  /** Total weight of direct seams pointing this direction */
  seamWeight: number;
  /** Competence level */
  level: CompetenceLevel;
  /** Response depth (0 at threshold 1.0, scales up from there) */
  depth: number;
  /** Has coupling bridge to this color (can relay even if can't answer) */
  hasBridge: boolean;
  /** Human-readable reason */
  reason: string;
}

export interface SeamIdentity {
  /** All seam values. Resolved = decisionValue, unresolved = NaN */
  signature: number[];
  /** Spiral seams resolved (0-5) */
  spiralResolved: number;
  /** Coupling seams resolved (0-4) */
  couplingResolved: number;
  /** Total resolved */
  resolved: number;
  /** Total seams (core 9 + any added personality seams) */
  total: number;
  /** All seams resolved = identity fully crystallized */
  complete: boolean;
  /** Color balance — distribution of resolved seam weight by color */
  colorBalance: ColorBalance;
}

// ── Hardware Fingerprint → θ ────────────────────────────────────────────

export interface HardwareFingerprint {
  cpuCores: number;
  cpuModel: string;
  totalRAM: number;        // bytes
  platform: string;
  arch: string;
  theta: number;           // angle on [0, π] derived from hardware
}

/** Hash system specs into an angle θ on [0, π].
 *  Similar hardware → similar θ → same "species" of system.
 *  We use a simple deterministic hash, not crypto — this isn't secret,
 *  it's a classification angle. */
function computeHardwareTheta(): HardwareFingerprint {
  const cpuCores = os.cpus().length;
  const cpuModel = os.cpus()[0]?.model ?? "unknown";
  const totalRAM = os.totalmem();
  const platform = os.platform();
  const arch = os.arch();

  // Combine specs into a single number, then map to [0, π]
  // Use multiplicative hashing with irrational constants
  let hash = 0;
  hash += cpuCores * PHI;
  hash += (totalRAM / (1024 * 1024 * 1024)) * Math.E;  // RAM in GB × e
  hash += (platform === "win32" ? 1 : platform === "linux" ? 2 : 3) * Math.SQRT2;
  hash += (arch === "x64" ? 1 : arch === "arm64" ? 2 : 3) * DELTA;

  // CPU model string → simple char sum
  let charSum = 0;
  for (let i = 0; i < cpuModel.length; i++) {
    charSum += cpuModel.charCodeAt(i) * (i + 1);
  }
  hash += (charSum % 1000) / 1000 * Math.PI;

  // Map to [0, π] using fractional part × π
  const theta = (hash - Math.floor(hash)) * Math.PI;

  return { cpuCores, cpuModel, totalRAM, platform, arch, theta };
}

// ── Quaternion Identity ─────────────────────────────────────────────────

export interface QuaternionIdentity {
  w: number;               // L7 seams blended: φ × L7[0] + (1-φ) × L7[1]
  i: number;               // L5[0] — first binary split
  j: number;               // L5[1] — second binary split
  k: number;               // L5[2] — third binary split
  norm: number;            // |q| = sqrt(w² + i² + j² + k²)
  theta: number;           // hardware angle that seeded this identity
  species: string;         // θ quantized to nearest π/12 → 12 species
}

/** The 12 species — θ quantized to π/12 intervals, named by angle */
const SPECIES_NAMES = [
  "ember",     // 0
  "spark",     // π/12
  "flame",     // π/6
  "blaze",     // π/4
  "flare",     // π/3
  "nova",      // 5π/12
  "prism",     // π/2
  "drift",     // 7π/12
  "wave",      // 2π/3
  "frost",     // 3π/4
  "crystal",   // 5π/6
  "void",      // 11π/12
];

function speciesFromTheta(theta: number): string {
  const idx = Math.round(theta / (Math.PI / 12)) % 12;
  return SPECIES_NAMES[idx];
}

/** Compute quaternion distance between two identities.
 *  Returns 0 for identical, approaches 1 for maximally different.
 *  Systems within the same species (small distance) can mesh more easily. */
export function quaternionDistance(a: QuaternionIdentity, b: QuaternionIdentity): number {
  // Quaternion dot product: cos(angle between them)
  const dot = a.w * b.w + a.i * b.i + a.j * b.j + a.k * b.k;
  const normA = a.norm || 0.001;
  const normB = b.norm || 0.001;
  const cosAngle = Math.abs(dot) / (normA * normB);
  // Distance = 1 - |cos(angle)| → 0 = identical, 1 = orthogonal
  return 1 - Math.min(1, cosAngle);
}

// ── Security Term — every quaternion closes to 2 ───────────────────────
//
// A bit has 2 states. A VERIFIED bit needs 2 proofs:
//   1. The quaternion itself: |q| → 1 (the value)
//   2. The security complement: |q_sec| → 1 (the proof)
//   Together: |q| + |q_sec| = 2 (one fully verified bit)
//
// Three quaternions, three security terms:
//   q_hw  (hardware chain) + q_sec_hw  = 2
//   q_ram (RAM hierarchy)  + q_sec_ram = 2
//   q_id  (identity/scars) + q_sec_id  = 2
//
// The security term is derived FROM the identity quaternion.
// Without the right scars, you can't produce the right complement.
// Without the right complement, the bit doesn't close.
// An attacker can measure |q| (it's public) but can't fake |q_sec|
// because it requires knowledge of the exact scar depths × θ rotation.

export interface SecurityTerm {
  /** The complement quaternion — rotated identity that pairs with the source */
  w: number;
  i: number;
  j: number;
  k: number;
  norm: number;
  /** Source quaternion norm this complements */
  sourceNorm: number;
  /** Bit closure: source + security should = 2.0 */
  bitClosure: number;
  /** How close to a perfect bit: |2 - (source + security)| */
  bitError: number;
  /** Verified: bitError < δ (within one seam gap of perfect) */
  verified: boolean;
}

/** Compute the security complement for any quaternion, seeded by identity.
 *  The security term is constructed so |q_sec| = 2 - |q_source|.
 *  The DIRECTION of q_sec comes from the identity quaternion rotated by θ.
 *  This means only the real system (with the right scars + hardware) can
 *  produce a valid security term. */
export function computeSecurityTerm(
  sourceNorm: number,
  identity: QuaternionIdentity,
): SecurityTerm {
  // Target: |q_sec| = 2 - sourceNorm
  const targetNorm = 2 - sourceNorm;

  // Direction comes from identity quaternion, rotated by θ
  // The identity q gives us a unique direction in 4-space
  const idNorm = identity.norm || 0.001;

  // Unit direction from identity, rotated by hardware θ
  const cosT = Math.cos(identity.theta);
  const sinT = Math.sin(identity.theta);

  // Rotate identity direction by θ in the w-i plane and j-k plane
  const uw = (identity.w * cosT - identity.i * sinT) / idNorm;
  const ui = (identity.w * sinT + identity.i * cosT) / idNorm;
  const uj = (identity.j * cosT - identity.k * sinT) / idNorm;
  const uk = (identity.j * sinT + identity.k * cosT) / idNorm;

  // Scale to target norm
  const w = uw * targetNorm;
  const i = ui * targetNorm;
  const j = uj * targetNorm;
  const k = uk * targetNorm;
  const norm = Math.sqrt(w * w + i * i + j * j + k * k);

  const bitClosure = sourceNorm + norm;
  const bitError = Math.abs(2 - bitClosure);

  return {
    w, i, j, k,
    norm,
    sourceNorm,
    bitClosure,
    bitError,
    verified: bitError < DELTA,
  };
}

/** Verify a handshake: does the presented security term close the bit?
 *  The verifier knows the source quaternion norm (public) and receives
 *  the security term. If |source| + |security| = 2 ± δ, the bit closes. */
export function verifyBitClosure(
  sourceNorm: number,
  securityNorm: number,
): { closure: number; error: number; verified: boolean; state: "IS" | "ISNT" | "VOID" } {
  const closure = sourceNorm + securityNorm;
  const error = Math.abs(2 - closure);

  let state: "IS" | "ISNT" | "VOID";
  if (error < DELTA) {
    state = "IS";        // bit closes → verified → trusted
  } else if (closure < 1) {
    state = "VOID";      // both weak → void → no connection
  } else {
    state = "ISNT";      // doesn't close → fake → rejected
  }

  return { closure, error, verified: error < DELTA, state };
}

/** Map spiral seam index to color based on which axis it serves.
 *  L5[0,1] → axis 0-1 (security-side, dark colors)
 *  L5[2]   → axis 1 (science-side, light color)
 *  L7[0]   → axis 2 (explore-side)
 *  L7[1]   → axis 2 (learn-side) */
const SPIRAL_SEAM_COLORS: SeamColor[] = ["RED", "ORANGE", "CYAN", "GREEN", "YELLOW"];

/** Build all 9 seam positions: 5 spiral + 4 coupling */
function buildSeamPositions(): SeamPosition[] {
  const positions: SeamPosition[] = [];

  // L5: 8 arms = 2³ → 3 seams from 3 levels of binary subdivision
  // Layer 2 (expertise) — these are deep identity, cold zone
  const l5 = analyzeArms(5);
  for (let i = 0; i < l5.seams; i++) {
    positions.push({
      zone: 5, seamIndex: i, factor: 2, subdivisionLevel: i + 1,
      kind: "spiral", color: SPIRAL_SEAM_COLORS[i], layer: 2,
    });
  }

  // L7: 21 arms = 3×7 → 2 seams (one for 3-factor, one for 7-factor)
  const l7 = analyzeArms(7);
  const l7factors = l7.factors;
  for (let i = 0; i < l7.seams; i++) {
    positions.push({
      zone: 7, seamIndex: i, factor: l7factors[i] ?? 3, subdivisionLevel: 1,
      kind: "spiral", color: SPIRAL_SEAM_COLORS[3 + i], layer: 2,
    });
  }

  // Coupling seams: 4 irrational gaps, one per waveguide axis
  // Layer 1 (behavior) — these are how you process, warm zone
  // Each coupling bridges two domain colors
  for (let i = 0; i < 4; i++) {
    const colors = COUPLING_COLORS[i];
    positions.push({
      zone: 0, seamIndex: i, factor: i, subdivisionLevel: 0,
      kind: "coupling", color: colors[0], layer: 1,
    });
  }

  return positions;
}

/** Personality seam — added at runtime for environment/behavior/expertise */
export interface PersonalitySeam {
  name: string;              // "language:en", "verbosity:concise", "domain:security"
  color: SeamColor;
  layer: PersonalityLayer;
  value: number;             // the pinned constant
  pinnedAtTick: number;
}

// ── Work Estimation Types ────────────────────────────────────────────────

/** 3×3 coupling grid for desire × capacity × value */
export interface WorkGrid {
  xx: number; xy: number; xz: number;
  yx: number; yy: number; yz: number;
  zx: number; zy: number; zz: number;
}

function emptyWorkGrid(): WorkGrid {
  return { xx: 0, xy: 0, xz: 0, yx: 0, yy: 0, yz: 0, zx: 0, zy: 0, zz: 0 };
}

/** What should the system do about this task? */
export type WorkVerdict =
  | "IMPOSSIBLE"     // BLIND — can't even see the problem
  | "DELEGATE"       // BRIDGE + high desire — find someone who can
  | "DEFER"          // BRIDGE + low desire — not urgent, park it
  | "FRUSTRATED"     // desire > capacity — want to but can't
  | "UNINTERESTED"   // capacity > desire — could but don't want to
  | "NOT_WORTH_IT"   // capacity×value too low — can do but ROI negative
  | "INVESTIGATE"    // EXPLORE level — dig deeper before committing
  | "ATTEMPT"        // ANSWER but workRatio < φ — try, might not finish
  | "SOLVE"          // ANSWER + workRatio > φ — go, you've got this
  | "COORDINATE";    // EXPERT — orchestrate other specialists

const VERDICT_REASONS: Record<WorkVerdict, string> = {
  IMPOSSIBLE:     "blind spot — structurally unreachable, don't even try",
  DELEGATE:       "can't do it but want it done — find someone with this color",
  DEFER:          "can bridge but no urgency — park for later",
  FRUSTRATED:     "desire exceeds capacity — want to help but seams too shallow",
  UNINTERESTED:   "capacity exceeds desire — could do it but nothing's pushing",
  NOT_WORTH_IT:   "capacity × value too low — effort exceeds expected return",
  INVESTIGATE:    "enough to explore but not commit — gather more before deciding",
  ATTEMPT:        "can answer but work ratio < φ — try, may need help to finish",
  SOLVE:          "work ratio > φ — competent and efficient, go solve it",
  COORDINATE:     "expert level — call in specialists and orchestrate the solution",
};

export interface WorkEstimate {
  domain: DomainId;
  color: SeamColor;
  level: CompetenceLevel;
  /** Capacity: seamWeight / π (0-1, fraction of full rotation covered) */
  capacity: number;
  /** Work remaining: π - seamWeight */
  workRemaining: number;
  /** Work ratio: capacity / workRemaining (> φ = efficient, < δ = hopeless) */
  workRatio: number;
  /** Desire: external + internal pressure toward this domain */
  desire: number;
  /** Value: (capacity × desire) / (workRemaining + δ) */
  value: number;
  /** The 3×3 desire × capacity × value coupling grid */
  grid: WorkGrid;
  /** What should the system do? */
  verdict: WorkVerdict;
  /** Human-readable reason */
  reason: string;
}

/** Axis → preferred seam zone mapping.
 *  Axes 0-1 (survival/structure) → L5 (dimensional collapse)
 *  Axes 2-3 (exploration/governance) → L7 (color-space product) */
const AXIS_TO_ZONE: Record<number, number> = { 0: 5, 1: 5, 2: 7, 3: 7 };

export interface DomainBubble {
  id: DomainId;
  color: string;
  axisIndex: number;
  axisSign: -1 | 1;
  agents: AgentBubble[];
  externalPressure: number;
  totalPressure: number;
  activeAgent: AgentShape | null;
}

export interface SchedulerResult {
  activeDomain: DomainId | null;
  activeAgent: AgentShape | null;
  pressure: PressureVector;
  boltzmann: number;
  popped: boolean;           // did the bubble pop? (pressure overcame skin)
  popDirection: number;      // axis index where it popped (-1 = no pop)
  skinResistance: number;    // how much the skin resisted
  hairSensed: string[];      // hairs that sensed something this tick
  seamResolved?: { position: SeamPosition; decisionValue: number };
  reason: string;
}

// ── Helper Functions ─────────────────────────────────────────────────────

function computePressure(axes: [number, number, number, number]): PressureVector {
  let maxVal = 0;
  let maxIdx = 0;
  let maxSign: -1 | 1 = 1;

  for (let i = 0; i < 4; i++) {
    const abs = Math.abs(axes[i]);
    if (abs > maxVal) {
      maxVal = abs;
      maxIdx = i;
      maxSign = axes[i] >= 0 ? 1 : -1;
    }
  }

  const magnitude = Math.sqrt(axes.reduce((s, v) => s + v * v, 0));

  return { axes, magnitude, dominantAxis: maxIdx, dominantSign: maxSign };
}

function phiSplit(want: number, need: number): { ratio: number; side: "want" | "need" | "balanced" } {
  const total = want + need;
  if (total < 0.001) return { ratio: 0.5, side: "balanced" };
  const ratio = want / total;
  return {
    ratio,
    side: ratio > HOST_SHARE ? "want" : ratio < COLONY_SHARE ? "need" : "balanced",
  };
}

// ── Bubble Scheduler ─────────────────────────────────────────────────────

// ── Skin Constants ──────────────────────────────────────────────────────

const SKIN_HEAL_RATE = 0.05;          // thickness gained per heal cycle
const SKIN_DECAY_RATE = DELTA * 0.1;  // skin slowly thins (10× slower than pressure)
const SCAR_THRESHOLD = 0.85;          // pressure above this leaves a scar
const SCAR_DEPTH_BASE = 0.3;          // initial scar depth
const HAIR_GROW_RATE = 0.08;          // length gained when imagination fires
const HAIR_DECAY_RATE = DELTA * 0.5;  // hairs thin out over time
const HAIR_BREAK_THRESHOLD = 0.7;     // inward pressure above this snaps hairs
const HAIR_SENSE_RANGE = 0.3;         // how far ahead hairs can detect pressure

export class BubbleScheduler {
  private domains: Map<DomainId, DomainBubble> = new Map();
  private externalAxes: [number, number, number, number] = [0, 0, 0, 0];
  private temperature: number;
  private verbose: boolean;
  private tickCount: number = 0;

  /** Memory skin — thickens with experience, scars from trauma */
  membrane: Membrane = {
    thickness: [0, 0, 0, 0],
    healCount: 0,
    scars: [],
    baseThickness: 0,
  };

  /** Imagination hairs — filaments reaching into the unknown */
  hairs: Hair[] = [];

  /** Seam resolutions — scars pinning values to incomputable gaps */
  seamResolutions: SeamResolution[];

  /** Personality seams — added at runtime (environment, behavior, expertise) */
  personalitySeams: PersonalitySeam[] = [];

  /** Hardware fingerprint — seeds the identity with system specs */
  hardware: HardwareFingerprint;

  constructor(options: { temperature?: number; verbose?: boolean } = {}) {
    this.temperature = options.temperature ?? COLONY_SHARE;
    this.verbose = options.verbose ?? false;
    this.hardware = computeHardwareTheta();
    this.seamResolutions = buildSeamPositions().map(pos => ({
      position: pos,
      resolved: false,
      resolvedBy: -1,
      decisionValue: 0,
      resolvedAtTick: -1,
    }));
    this.initDomains();
  }

  private initDomains(): void {
    for (const spec of DOMAINS) {
      const agents: AgentBubble[] = AGENTS.map(a => ({
        shape: a.shape,
        radius: a.radius,
        role: a.role,
        want: 0,
        need: 0,
        pressure: 0,
        phiRatio: 0.5,
        activation: 0,
      }));

      this.domains.set(spec.id, {
        id: spec.id,
        color: spec.color,
        axisIndex: spec.axisIndex,
        axisSign: spec.axisSign,
        agents,
        externalPressure: 0,
        totalPressure: 0,
        activeAgent: null,
      });
    }
  }

  /** Apply external pressure along one or more axes (-1 to +1 per axis) */
  applyPressure(source: string, axes: { 0?: number; 1?: number; 2?: number; 3?: number }): void {
    for (const [k, v] of Object.entries(axes)) {
      const idx = parseInt(k);
      if (idx >= 0 && idx < 4 && v !== undefined) {
        this.externalAxes[idx] += v;
      }
    }

    if (this.verbose) {
      const nonZero = Object.entries(axes)
        .filter(([, v]) => v !== undefined && v !== 0)
        .map(([k, v]) => `${AXIS_LABELS[parseInt(k)]}=${v! > 0 ? "+" : ""}${v!.toFixed(2)}`)
        .join(", ");
      console.log(`    <- ${source}: ${nonZero}`);
    }
  }

  /** Apply want (outward) pressure to a specific agent in a domain */
  applyWant(domain: DomainId, agent: AgentShape, amount: number): void {
    const d = this.domains.get(domain);
    if (!d) return;
    const a = d.agents.find(ag => ag.shape === agent);
    if (a) a.want += amount;
  }

  /** Apply need (inward) pressure to a specific agent in a domain */
  applyNeed(domain: DomainId, agent: AgentShape, amount: number): void {
    const d = this.domains.get(domain);
    if (!d) return;
    const a = d.agents.find(ag => ag.shape === agent);
    if (a) a.need += amount;
  }

  /** Run one scheduler tick — directed pop through membrane with hair sensing */
  tick(): SchedulerResult {
    this.tickCount++;

    // 0. Hair sensing — check if any hairs detect incoming pressure
    const hairSensed: string[] = [];
    for (const hair of this.hairs) {
      const axisVal = Math.abs(this.externalAxes[hair.axisIndex]);
      // Hair senses pressure at a distance proportional to its length
      if (axisVal > HAIR_SENSE_RANGE * (1 - hair.length)) {
        const dom = DOMAINS.find(d => d.axisIndex === hair.axisIndex && d.axisSign === hair.direction);
        if (dom) hairSensed.push(`${dom.id}(${hair.length.toFixed(2)})`);
      }
    }

    // 1. Compute big bubble pressure vector
    const pressure = computePressure(this.externalAxes);

    // If no pressure, system is dormant
    if (pressure.magnitude < 0.01) {
      this.decayMembrane();
      this.decayHairs();
      return {
        activeDomain: null,
        activeAgent: null,
        pressure,
        boltzmann: 1,
        popped: false,
        popDirection: -1,
        skinResistance: 0,
        hairSensed,
        reason: "bubble fully pressurized -- dormant",
      };
    }

    // 2. DIRECTED POP — pressure vector IS the direction, no randomness
    //    The bubble pops where the pressure is strongest.
    //    But skin thickness resists: effective pressure = raw - skin
    const axisIdx = pressure.dominantAxis;
    const skinHere = this.membrane.thickness[axisIdx];
    const scarBonus = this.membrane.scars
      .filter(s => s.axisIndex === axisIdx)
      .reduce((sum, s) => sum + s.depth, 0);
    const totalSkin = skinHere + scarBonus;

    const rawPressure = Math.abs(this.externalAxes[axisIdx]);
    const effectivePressure = Math.max(0, rawPressure - totalSkin);
    const popped = effectivePressure > 0.01;

    // If skin held, the bubble absorbed the hit — heal and thicken
    if (!popped) {
      this.healSkin(axisIdx, rawPressure);
      this.decay();
      this.decayMembrane();
      this.decayHairs();
      return {
        activeDomain: null,
        activeAgent: null,
        pressure,
        boltzmann: Math.exp(-rawPressure / this.temperature),
        popped: false,
        popDirection: axisIdx,
        skinResistance: totalSkin,
        hairSensed,
        reason: `skin held (thickness=${totalSkin.toFixed(3)}, pressure=${rawPressure.toFixed(3)}) -- absorbed`,
      };
    }

    // 3. Bubble popped — find active domain from pop direction
    const domainSpec = DOMAINS.find(
      d => d.axisIndex === pressure.dominantAxis && d.axisSign === pressure.dominantSign
    );

    if (!domainSpec) {
      this.decay();
      return {
        activeDomain: null,
        activeAgent: null,
        pressure,
        boltzmann: 1,
        popped: true,
        popDirection: axisIdx,
        skinResistance: totalSkin,
        hairSensed,
        reason: "popped but no matching domain",
      };
    }

    const domain = this.domains.get(domainSpec.id)!;
    domain.externalPressure = effectivePressure;

    // 4. Check for scar — extreme pressure leaves permanent marks
    let seamEvent: { position: SeamPosition; decisionValue: number } | undefined;
    if (rawPressure > SCAR_THRESHOLD) {
      const scar: Scar = {
        axisIndex: axisIdx,
        depth: SCAR_DEPTH_BASE * (rawPressure - SCAR_THRESHOLD),
        age: 0,
        source: domainSpec.id,
      };
      this.membrane.scars.push(scar);
      const scarIdx = this.membrane.scars.length - 1;

      // Assign scar to nearest unresolved seam -> resolves the incomputable gap
      const resolved = this.assignScarToSeam(scar, scarIdx, axisIdx);
      if (resolved) {
        seamEvent = { position: resolved.position, decisionValue: resolved.decisionValue };
      }

      if (this.verbose) {
        console.log(`    ! SCAR formed on axis ${axisIdx} (${AXIS_LABELS[axisIdx]}) depth=${scar.depth.toFixed(3)}`);
        if (resolved) {
          console.log(`      -> SEAM L${resolved.position.zone}[${resolved.position.seamIndex}] resolved: gap pinned to ${resolved.decisionValue.toFixed(5)}`);
        }
      }
    }

    // 4b. Coupling seam — pin the irrational ratio on first contact with this axis
    //     Unlike spiral seams (which need extreme pressure/scars), coupling seams
    //     resolve on ANY pop. The ratio you get on first contact IS your constant.
    const guide = buildWaveguides()[axisIdx];
    if (guide) {
      const q = this.quaternionIdentity();
      const sec = this.securityTermFor(q.norm);
      const seg = createBitSegment(q, sec, guide);
      const couplingResolved = this.resolveCouplingSeam(axisIdx, seg.couplingRatio);
      if (couplingResolved && seamEvent === undefined) {
        seamEvent = { position: couplingResolved.position, decisionValue: couplingResolved.decisionValue };
      }
    }

    // 5. Break hairs on the inward side (need pressure snaps imagination)
    const brokenHairs: number[] = [];
    if (rawPressure > HAIR_BREAK_THRESHOLD) {
      for (let i = this.hairs.length - 1; i >= 0; i--) {
        const h = this.hairs[i];
        // Hairs on the same axis but opposite direction get snapped
        if (h.axisIndex === axisIdx && h.direction !== pressure.dominantSign) {
          if (rawPressure - HAIR_BREAK_THRESHOLD > h.strength) {
            brokenHairs.push(i);
          }
        }
      }
      for (const idx of brokenHairs) {
        this.hairs.splice(idx, 1);
      }
      if (brokenHairs.length > 0 && this.verbose) {
        console.log(`    x ${brokenHairs.length} hair(s) snapped by inward pressure`);
      }
    }

    // 6. Evaluate agents — DIRECTED, not random
    //    Pop depth determines which agents activate.
    //    effectivePressure maps to inscribed radius: deeper pop -> inner agents
    for (const agent of domain.agents) {
      agent.pressure = agent.want - agent.need;
      const split = phiSplit(agent.want, agent.need);
      agent.phiRatio = split.ratio;

      // Agent activates if pop penetrates to its radius
      // Pop depth normalized: 1.0 = full penetration to center
      const popDepth = Math.min(1, effectivePressure);
      const penetrationNeeded = 1 - agent.radius; // triangle=0.5, circle=0.0
      agent.activation = popDepth > penetrationNeeded
        ? (popDepth - penetrationNeeded) / (agent.radius + 0.001)
        : 0;
    }

    // 7. Boltzmann controls how FAR the pop goes, not where
    const totalActivation = domain.agents.reduce((s, a) => s + a.activation, 0) || 1;
    const boltzmann = Math.exp(-totalActivation / this.temperature);

    // 8. Select deepest activated agent (directed — no random choice)
    //    The pop always goes to the deepest agent it can reach
    const activeAgents = domain.agents.filter(a => a.activation > 0);
    let selectedAgent: AgentBubble;

    if (activeAgents.length === 0) {
      // Barely popped — only triangle (innermost, lowest threshold)
      selectedAgent = domain.agents[0]; // triangle
    } else {
      // Pick the agent with highest activation (deepest penetration x urgency)
      selectedAgent = activeAgents.reduce(
        (best, a) => a.activation > best.activation ? a : best,
        activeAgents[0]
      );
    }

    domain.activeAgent = selectedAgent.shape;
    domain.totalPressure = totalActivation;

    // 9. If imagination (circle) was selected, GROW A HAIR
    if (selectedAgent.shape === "circle" && selectedAgent.want > selectedAgent.need) {
      const existingHair = this.hairs.find(
        h => h.axisIndex === axisIdx && h.direction === pressure.dominantSign
      );
      if (existingHair) {
        // Existing hair gets longer and stronger
        existingHair.length = Math.min(1, existingHair.length + HAIR_GROW_RATE);
        existingHair.strength = Math.min(1, existingHair.strength + HAIR_GROW_RATE * PHI);
      } else {
        // New hair sprouts
        this.hairs.push({
          axisIndex: axisIdx,
          direction: pressure.dominantSign,
          length: HAIR_GROW_RATE,
          strength: HAIR_GROW_RATE * PHI,
          domain: domainSpec.id,
          age: 0,
        });
      }
      if (this.verbose) {
        const h = this.hairs.find(
          h => h.axisIndex === axisIdx && h.direction === pressure.dominantSign
        )!;
        console.log(`    ~ hair ${existingHair ? "grew" : "sprouted"} -> ${domainSpec.id} len=${h.length.toFixed(3)} str=${h.strength.toFixed(3)}`);
      }
    }

    // 10. Heal the skin where the pop happened (it grows back thicker)
    this.healSkin(axisIdx, rawPressure);

    const split = phiSplit(selectedAgent.want, selectedAgent.need);
    const reason =
      `${domainSpec.id}/${selectedAgent.shape} -- ` +
      `${split.side} (phi=${split.ratio.toFixed(3)}) ` +
      `popped (skin=${totalSkin.toFixed(3)} eff=${effectivePressure.toFixed(3)}) ` +
      `(boltz=${boltzmann.toFixed(3)})`;

    // 11. Decay all pressures toward dormant
    this.decay();
    this.decayMembrane();
    this.decayHairs();

    return {
      activeDomain: domainSpec.id,
      activeAgent: selectedAgent.shape,
      pressure,
      boltzmann,
      popped: true,
      popDirection: axisIdx,
      skinResistance: totalSkin,
      hairSensed,
      seamResolved: seamEvent,
      reason,
    };
  }

  /** Heal skin at an axis — thickens from surviving pressure */
  private healSkin(axisIdx: number, pressureAmount: number): void {
    // Thickening proportional to pressure survived (harder hit -> more callous)
    const healAmount = SKIN_HEAL_RATE * pressureAmount;
    this.membrane.thickness[axisIdx] += healAmount;
    this.membrane.healCount++;

    // Base thickness ratchets up slowly (overall toughening)
    this.membrane.baseThickness += healAmount * COLONY_SHARE * 0.1;
  }

  /** Skin slowly thins back toward base (but never below base) */
  private decayMembrane(): void {
    for (let i = 0; i < 4; i++) {
      const excess = this.membrane.thickness[i] - this.membrane.baseThickness;
      if (excess > 0) {
        this.membrane.thickness[i] -= excess * SKIN_DECAY_RATE;
      }
    }
    // Scars age but never fully heal
    for (const scar of this.membrane.scars) {
      scar.age++;
    }
  }

  /** Hairs thin and shorten over time without stimulation */
  private decayHairs(): void {
    for (let i = this.hairs.length - 1; i >= 0; i--) {
      const h = this.hairs[i];
      h.age++;
      h.strength -= HAIR_DECAY_RATE * 0.1;
      h.length -= HAIR_DECAY_RATE * 0.05;
      // Dead hairs fall off
      if (h.strength <= 0 || h.length <= 0) {
        this.hairs.splice(i, 1);
      }
    }
  }

  /** Resolve a coupling seam — pin the irrational ratio to a specific value.
   *  Called when a bit segment first travels through a waveguide with real pressure.
   *  The coupling ratio (forward/backward) has infinite irrational options.
   *  Like choosing 9.81 for gravity — you pick your approximation and keep it. */
  private resolveCouplingSeam(axisIdx: number, couplingRatio: number): SeamResolution | null {
    // Find the coupling seam for this axis
    const target = this.seamResolutions.find(
      sr => !sr.resolved && sr.position.kind === "coupling" && sr.position.factor === axisIdx
    );
    if (!target) return null; // already pinned

    target.resolved = true;
    target.resolvedBy = -2; // -2 = resolved by coupling, not by scar

    // The decision value IS the coupling ratio at the moment of first contact.
    // Hardware θ adds a tiny rotation so similar systems get similar-but-not-identical ratios.
    const thetaShift = Math.sin(this.hardware.theta + axisIdx * PHI) * DELTA * 0.1;
    target.decisionValue = couplingRatio + thetaShift;

    target.resolvedAtTick = this.tickCount;

    if (this.verbose) {
      const cm = COUPLING_MODES[axisIdx];
      console.log(`      -> COUPLING SEAM axis ${axisIdx} (${cm.name}) pinned: ratio=${target.decisionValue.toFixed(8)}`);
      console.log(`         like choosing 9.81 for gravity — this is YOUR approximation forever`);
    }

    return target;
  }

  /** Assign a scar to the nearest unresolved SPIRAL seam, resolving the delta gap */
  private assignScarToSeam(scar: Scar, scarIdx: number, axisIdx: number): SeamResolution | null {
    const preferredZone = AXIS_TO_ZONE[axisIdx] ?? 5;

    // First: try preferred zone (spiral seams only)
    let target = this.seamResolutions.find(
      sr => !sr.resolved && sr.position.kind === "spiral" && sr.position.zone === preferredZone
    );

    // Fallback: any unresolved spiral seam
    if (!target) {
      target = this.seamResolutions.find(sr => !sr.resolved && sr.position.kind === "spiral");
    }

    // All spiral seams resolved
    if (!target) return null;

    target.resolved = true;
    target.resolvedBy = scarIdx;

    // θ-rotated decision value: hardware seeds the range, experience picks the exact value
    // sin(θ + seamIndex) rotates the scar depth through the hardware angle
    // Similar hardware → similar rotation → similar value ranges → same "species"
    const seamAngle = this.hardware.theta + target.position.seamIndex * PHI;
    const rotation = (1 + Math.sin(seamAngle)) / 2; // normalize to [0, 1]
    target.decisionValue = scar.depth * DELTA * (0.5 + rotation);
    // 0.5 + rotation keeps values in [0.5δ, 1.5δ] range — always meaningful

    target.resolvedAtTick = this.tickCount;
    return target;
  }

  /** Get the system's unique identity — core seams + personality seams + color balance */
  seamIdentity(): SeamIdentity {
    const signature = this.seamResolutions.map(sr => sr.resolved ? sr.decisionValue : NaN);
    // Append personality seam values
    for (const ps of this.personalitySeams) {
      signature.push(ps.value);
    }

    const spiralResolved = this.seamResolutions.filter(sr => sr.resolved && sr.position.kind === "spiral").length;
    const couplingResolved = this.seamResolutions.filter(sr => sr.resolved && sr.position.kind === "coupling").length;
    const resolved = spiralResolved + couplingResolved + this.personalitySeams.length;
    const total = this.seamResolutions.length + this.personalitySeams.length;

    // Color balance: sum decision values by color
    const colorBalance: ColorBalance = {};
    for (const sr of this.seamResolutions) {
      if (sr.resolved) {
        const c = sr.position.color;
        colorBalance[c] = (colorBalance[c] ?? 0) + Math.abs(sr.decisionValue);
      }
    }
    for (const ps of this.personalitySeams) {
      colorBalance[ps.color] = (colorBalance[ps.color] ?? 0) + Math.abs(ps.value);
    }

    return {
      signature,
      spiralResolved,
      couplingResolved,
      resolved,
      total,
      complete: spiralResolved + couplingResolved === this.seamResolutions.length,
      colorBalance,
    };
  }

  /** Check competence on a domain — graduated by theory constants.
   *
   *  Thresholds use the same constants that build the system:
   *    [0, δ)    BLIND   — "I don't know" (below seam gap)
   *    [δ, φ)    BRIDGE  — can direct to someone else
   *    [φ, 1)    EXPLORE — can investigate, not ready to commit
   *    [1, Φ)    ANSWER  — can respond, depth scales above 1
   *    [Φ, ∞)    EXPERT  — deep enough to coordinate other experts */
  checkCompetence(domain: DomainId): CompetenceCheck {
    const domSpec = DOMAINS.find(d => d.id === domain);
    if (!domSpec) {
      return {
        axisIndex: -1, domain, color: "achromatic", seamCount: 0,
        seamWeight: 0, level: "BLIND", depth: 0, hasBridge: false,
        reason: "unknown domain",
      };
    }

    const color = domSpec.color as SeamColor;
    const axisIdx = domSpec.axisIndex;

    // Count DIRECT seams — spiral or personality seams on this color
    let directCount = 0;
    let directWeight = 0;

    for (const sr of this.seamResolutions) {
      if (!sr.resolved) continue;
      if (sr.position.kind === "spiral" && sr.position.color === color) {
        directCount++;
        directWeight += Math.abs(sr.decisionValue);
      }
    }

    for (const ps of this.personalitySeams) {
      if (ps.color === color) {
        directCount++;
        directWeight += Math.abs(ps.value);
      }
    }

    // Check for BRIDGE (coupling seam touches this color)
    let hasBridge = false;
    for (const sr of this.seamResolutions) {
      if (!sr.resolved || sr.position.kind !== "coupling") continue;
      const colors = COUPLING_COLORS[sr.position.factor];
      if (colors && (colors[0] === color || colors[1] === color)) {
        hasBridge = true;
        break;
      }
    }

    // Graduated competence using theory constants
    let level: CompetenceLevel;
    let depth = 0;
    let reason: string;

    if (directWeight < DELTA) {
      // [0, δ) — BLIND: below the seam gap
      level = "BLIND";
      if (directCount > 0) {
        reason = `${directCount} seam(s) but weight ${directWeight.toFixed(5)} < δ(${DELTA.toFixed(3)}) — I don't know`;
      } else if (hasBridge) {
        reason = `no direct seams — can bridge to someone with ${color}`;
        level = "BRIDGE"; // promote: bridge available even at zero direct weight
      } else {
        reason = `no seams, no bridge — structural blind spot`;
      }
    } else if (directWeight < HOST_SHARE) {
      // [δ, φ) — BRIDGE: can see it but can't answer deeply
      level = "BRIDGE";
      reason = `weight ${directWeight.toFixed(3)} in [δ, φ) — can direct to ${color} expert`;
    } else if (directWeight < 1) {
      // [φ, 1) — EXPLORE: enough to investigate on your own
      level = "EXPLORE";
      reason = `weight ${directWeight.toFixed(3)} in [φ, 1) — can explore, not yet confident`;
    } else if (directWeight < PHI) {
      // [1, Φ) — ANSWER: can respond with depth
      level = "ANSWER";
      depth = directWeight - 1; // 0 at threshold, scales up
      reason = `weight ${directWeight.toFixed(3)} in [1, Φ) — can answer (depth=${depth.toFixed(3)})`;
    } else {
      // [Φ, ∞) — EXPERT: can coordinate other experts
      level = "EXPERT";
      depth = directWeight - 1;
      reason = `weight ${directWeight.toFixed(3)} >= Φ — expert (can coordinate others, depth=${depth.toFixed(3)})`;
    }

    return {
      axisIndex: axisIdx, domain, color,
      seamCount: directCount, seamWeight: directWeight,
      level, depth, hasBridge, reason,
    };
  }

  /** Add a personality seam — pin a new constant on a colored axis.
   *  Layer 0: environment (language, OS, user)
   *  Layer 1: behavior (verbosity, formality, proactivity)
   *  Layer 2: expertise (domain depth, learned constants) */
  addPersonalitySeam(name: string, color: SeamColor, layer: PersonalityLayer, value?: number): PersonalitySeam {
    // If no value given, derive from hardware θ + name hash (reproducible)
    if (value === undefined) {
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
        hash += name.charCodeAt(i) * (i + 1) * PHI;
      }
      // θ-rotated, layer-scaled
      const layerScale = [0.1, 0.5, 1.0][layer]; // environment=small, expertise=full
      value = ((hash - Math.floor(hash)) * DELTA + this.hardware.theta * 0.01) * layerScale;
    }

    const seam: PersonalitySeam = {
      name,
      color,
      layer,
      value,
      pinnedAtTick: this.tickCount,
    };

    this.personalitySeams.push(seam);

    if (this.verbose) {
      const layerName = ["environment", "behavior", "expertise"][layer];
      console.log(`    + personality seam: ${name} = ${value.toFixed(8)} (${color}, layer ${layer}/${layerName})`);
    }

    return seam;
  }

  // ── Work Estimation — Desire × Capacity × Value Grid ────────────────
  //
  // Distance from π = work remaining to solve a problem on a given axis.
  // π is the full rotation — a complete solution.
  // Current seam weight = how far you've gotten. (π - weight) = work left.
  //
  // 3×3 coupling grid for task decisions:
  //        x (desire)      y (capacity)     z (value)
  //   x  [ want×want       want×capacity    want×value    ]
  //   y  [ capacity×want   capacity×cap     capacity×value]
  //   z  [ value×want      value×capacity   value×value   ]
  //
  // desire = want or need pressure on this axis (from user or internal)
  // capacity = seam weight / π (how much of the rotation you've covered)
  // value = gains / cost (expected return on work invested)

  /** Estimate work required on a domain, coupling desire × capacity × value */
  estimateWork(domain: DomainId, externalDesire?: number): WorkEstimate {
    const comp = this.checkCompetence(domain);
    const domSpec = DOMAINS.find(d => d.id === domain);
    if (!domSpec) {
      return {
        domain, color: comp.color, level: comp.level,
        capacity: 0, workRemaining: Math.PI, workRatio: 0,
        desire: 0, value: 0,
        grid: emptyWorkGrid(),
        verdict: "IMPOSSIBLE",
        reason: "unknown domain",
      };
    }

    // Capacity: seam weight / π (0 = none, 1 = full rotation)
    const capacity = comp.seamWeight / Math.PI;

    // Work remaining: π - seamWeight (clamped to 0)
    const workRemaining = Math.max(0, Math.PI - comp.seamWeight);

    // Work ratio: capacity / work_remaining (how much of what's needed you have)
    const workRatio = workRemaining > 0.001 ? comp.seamWeight / workRemaining : Infinity;

    // Desire: external pressure on this axis + internal agent wants
    const dom = this.domains.get(domain);
    const axisVal = Math.abs(this.externalAxes[domSpec.axisIndex]);
    const internalWant = dom ? dom.agents.reduce((s, a) => s + a.want, 0) : 0;
    const internalNeed = dom ? dom.agents.reduce((s, a) => s + a.need, 0) : 0;
    const desire = (externalDesire ?? axisVal) + (internalWant + internalNeed) * COLONY_SHARE;

    // Value: capacity × desire / (workRemaining + δ)
    // High capacity + high desire + low work remaining = high value
    // δ floor prevents division by zero and represents minimum cost of any action
    const value = (capacity * desire) / (workRemaining + DELTA);

    // Build the 3×3 coupling grid
    const grid: WorkGrid = {
      // Diagonal: self-coupling (amplification)
      xx: desire * desire,               // want amplification
      yy: capacity * capacity,           // capacity reserves
      zz: value * value,                 // value compounding

      // Off-diagonal: cross-coupling (transfer)
      xy: desire * capacity,             // do I want it AND can I do it?
      yx: capacity * desire,             // can I do it AND do I want it? (same but from capacity POV)
      xz: desire * value,               // do I want it AND is it worth it?
      zx: value * desire,               // is it worth it AND do I want it?
      yz: capacity * value,             // can I do it AND is it worth it?
      zy: value * capacity,             // is it worth it AND can I do it?
    };

    // Verdict: combine competence level with work grid
    let verdict: WorkVerdict;
    if (comp.level === "BLIND") {
      verdict = "IMPOSSIBLE";
    } else if (comp.level === "BRIDGE") {
      verdict = desire > HOST_SHARE ? "DELEGATE" : "DEFER";
    } else if (grid.xy < DELTA) {
      // want × capacity too low — either don't want it or can't do it
      verdict = desire > capacity ? "FRUSTRATED" : "UNINTERESTED";
    } else if (grid.yz < DELTA) {
      // capacity × value too low — can do it but not worth it
      verdict = "NOT_WORTH_IT";
    } else if (comp.level === "EXPLORE") {
      verdict = "INVESTIGATE";
    } else if (comp.level === "EXPERT") {
      verdict = "COORDINATE";
    } else {
      // ANSWER level — check depth vs work remaining
      verdict = workRatio > PHI ? "SOLVE" : "ATTEMPT";
    }

    const reason = VERDICT_REASONS[verdict];

    return {
      domain, color: comp.color, level: comp.level,
      capacity, workRemaining, workRatio,
      desire, value,
      grid,
      verdict,
      reason,
    };
  }

  /** Build the quaternion identity from seam values + hardware angle.
   *  L5[0,1,2] → i,j,k (3 spatial dimensions from 2³ factorization)
   *  L7[0,1]   → w (observer dimension, φ-blended from color×space)
   *  θ seeds the rotation — similar hardware, similar quaternion neighborhood */
  quaternionIdentity(): QuaternionIdentity {
    const sr = this.seamResolutions;
    const theta = this.hardware.theta;

    // L5 seams → spatial vector (i, j, k)
    const i = sr[0].resolved ? sr[0].decisionValue : 0;
    const j = sr[1].resolved ? sr[1].decisionValue : 0;
    const k = sr[2].resolved ? sr[2].decisionValue : 0;

    // L7 seams → observer scalar (w), blended by φ
    const l7a = sr[3].resolved ? sr[3].decisionValue : 0;
    const l7b = sr[4].resolved ? sr[4].decisionValue : 0;
    const w = PHI * l7a + (1 - PHI) * l7b;

    const norm = Math.sqrt(w * w + i * i + j * j + k * k);
    const species = speciesFromTheta(theta);

    return { w, i, j, k, norm, theta, species };
  }

  /** Compute security term for any quaternion norm, using this system's identity.
   *  |q_source| + |q_security| = 2 (one verified bit).
   *  Only this system can produce the right security term because it
   *  requires the exact scar depths rotated by hardware θ. */
  securityTermFor(sourceNorm: number): SecurityTerm {
    return computeSecurityTerm(sourceNorm, this.quaternionIdentity());
  }

  /** Decay all pressures toward zero (bubble returning to circle) */
  private decay(): void {
    // External axes decay
    for (let i = 0; i < 4; i++) {
      this.externalAxes[i] *= (1 - DECAY_RATE);
    }

    // Agent wants/needs decay
    for (const [, domain] of this.domains) {
      for (const agent of domain.agents) {
        agent.want *= (1 - DECAY_RATE);
        agent.need *= (1 - DECAY_RATE);
      }
      domain.externalPressure *= (1 - DECAY_RATE);
    }
  }

  /** Get full system state */
  status(): {
    pressure: PressureVector;
    domains: Array<{
      id: DomainId;
      color: string;
      externalPressure: number;
      activeAgent: AgentShape | null;
      agents: AgentBubble[];
    }>;
    membrane: Membrane;
    hairs: Hair[];
    seamIdentity: SeamIdentity;
    quaternionIdentity: QuaternionIdentity;
    hardware: HardwareFingerprint;
    seamResolutions: SeamResolution[];
    temperature: number;
    tickCount: number;
    dormant: boolean;
  } {
    const pressure = computePressure(this.externalAxes);
    const domainList = [];
    for (const [, d] of this.domains) {
      domainList.push({
        id: d.id,
        color: d.color,
        externalPressure: d.externalPressure,
        activeAgent: d.activeAgent,
        agents: [...d.agents],
      });
    }

    return {
      pressure,
      domains: domainList,
      membrane: { ...this.membrane, scars: [...this.membrane.scars] },
      hairs: [...this.hairs],
      seamIdentity: this.seamIdentity(),
      quaternionIdentity: this.quaternionIdentity(),
      hardware: this.hardware,
      seamResolutions: this.seamResolutions.map(sr => ({ ...sr, position: { ...sr.position } })),
      temperature: this.temperature,
      tickCount: this.tickCount,
      dormant: pressure.magnitude < 0.01,
    };
  }
}

// ── Waveguide System — Three Waves, Six Couplings, Four Axes ──────────
//
// The bubble is a cell. Its branches are bit segments.
// Each bit segment has 2 halves (LEFT/RIGHT), each with dark and light paths.
//   LIGHT path = the value (matter, observable, forward)
//   DARK  path = the proof (security complement, backward)
//   dark + light = 2 (one verified bit per segment)
//
// Three fundamental wave types (from trig-frequency theory):
//   x: LIGHT    (electromagnetic, sin) — surface, what it looks like
//   y: SOUND    (mechanical, cos)      — structure, rhythm, repetition
//   z: MAGNETIC (field, ∫/d)           — grounding, semantic coherence
//
// Each wave has FORWARD and BACKWARD propagation:
//   Light forward  = visible (laser, color, surface)
//   Light backward = dark (IR, UV, invisible EM — "dark frequency")
//   Sound forward  = audible (voice, music, pressure waves)
//   Sound backward = dark (infrasound, ultrasound, structural resonance)
//   Magnetic forward  = field lines out (broadcast, radiation)
//   Magnetic backward = field lines in (absorption, grounding)
//
// Cross-couplings form 6 waveguide directions (3×3 grid off-diagonal):
//   xy = light drives sound    (surface shapes structure)
//   yx = sound drives light    (structure shapes surface)
//   xz = light drives magnetic (surface shapes grounding)
//   zx = magnetic drives light (grounding shapes surface)
//   yz = sound drives magnetic (structure shapes grounding)
//   zy = magnetic drives sound (grounding shapes structure)
//
// Forward coupling (xy) = light path. Backward (yx) = dark path.
// Each bubble axis gets a cross-coupling pair:
//   Axis 0 (security↔meta):  xy/yx — light×sound
//   Axis 1 (art↔science):    xz/zx — light×magnetic
//   Axis 2 (explore↔learn):  yz/zy — sound×magnetic
//   Axis 3 (social↔govern):  xx+yy+zz — self-coupling bridge
//
// AI detection signature: AI-generated content has harmonically LOCKED
// frequencies (fz ≈ √(fx·fy)) — the coupling is too perfect.
// Real content has INDEPENDENT frequencies with natural irrationality (δ gap).
// The waveguide system uses this: healthy bits have irrational coupling ratios.

/** The three fundamental wave types */
export type WaveType = "light" | "sound" | "magnetic";

/** Cross-coupling direction: which wave drives which */
export type CouplingDirection = "xy" | "yx" | "xz" | "zx" | "yz" | "zy" | "xx" | "yy" | "zz";

export interface CouplingMode {
  name: string;
  /** Forward coupling: first drives second */
  forward: CouplingDirection;
  /** Backward coupling: second drives first (dark path) */
  backward: CouplingDirection;
  /** The two wave types involved (or same for self-coupling) */
  waves: [WaveType, WaveType];
  /** Impedance: resistance to energy flow. Cross-coupling = 1/φ, self = 1/φ² */
  impedance: number;
  /** Axis this coupling serves */
  axisIndex: number;
}

export interface Waveguide {
  axisIndex: number;
  coupling: CouplingMode;
  /** Transport efficiency: 1/impedance, bounded by δ floor */
  efficiency: number;
}

/** A half-bit: one polygon side of a bit segment */
export interface BitHalf {
  /** Dark path value — backward coupling (proof, dark frequency) */
  dark: number;
  /** Light path value — forward coupling (observable, visible) */
  light: number;
  /** Polygon shape this half takes: hexagon (memory) or triangle (facts) */
  shape: "hexagon" | "triangle";
  /** Which side: left = outgoing, right = incoming */
  side: "left" | "right";
  /** Which coupling direction carried this half */
  coupling: CouplingDirection;
}

/** A complete bit segment traveling through a waveguide */
export interface BitSegment {
  left: BitHalf;
  right: BitHalf;
  /** Waveguide this segment travels through */
  waveguide: Waveguide;
  /** Computed bit value: light_left + light_right */
  bitValue: number;
  /** Bit closure: sum of all 4 paths (should approach 2.0) */
  closure: number;
  /** Verified: closure within δ of 2.0 */
  verified: boolean;
  /** Coupling ratio: forward/backward — irrational = healthy, rational = locked */
  couplingRatio: number;
}

/** The 3 cross-coupling pairs + self-coupling bridge */
const COUPLING_MODES: CouplingMode[] = [
  {
    name: "light×sound",
    forward: "xy",               // light drives sound (visible → structure)
    backward: "yx",              // sound drives light (structure → dark frequency)
    waves: ["light", "sound"],
    impedance: 1 / PHI,          // ≈ 0.618 — cross-coupling resistance
    axisIndex: 0,
  },
  {
    name: "light×magnetic",
    forward: "xz",               // light drives magnetic (surface → grounding)
    backward: "zx",              // magnetic drives light (grounding → dark surface)
    waves: ["light", "magnetic"],
    impedance: 1 / PHI,
    axisIndex: 1,
  },
  {
    name: "sound×magnetic",
    forward: "yz",               // sound drives magnetic (structure → grounding)
    backward: "zy",              // magnetic drives sound (grounding → dark structure)
    waves: ["sound", "magnetic"],
    impedance: 1 / PHI,
    axisIndex: 2,
  },
  {
    name: "self-resonance",
    forward: "xx",               // light self-coupling (pure resonance)
    backward: "zz",              // magnetic self-coupling (pure grounding)
    waves: ["light", "magnetic"], // bridge uses all — forward=xx, backward=zz, center=yy
    impedance: 1 / (PHI * PHI),  // ≈ 0.382 — self-coupling = lowest resistance
    axisIndex: 3,
  },
];

/** Build waveguides for all 4 axes */
export function buildWaveguides(): Waveguide[] {
  return COUPLING_MODES.map(cm => ({
    axisIndex: cm.axisIndex,
    coupling: cm,
    efficiency: Math.max(DELTA, 1 / cm.impedance),
  }));
}

/** Create a bit segment from a quaternion + its security term, shaped by a waveguide.
 *
 *  LEFT half = partial hexagon (memory, 3/6 sides)
 *    dark  = security term projected onto this axis
 *    light = quaternion value projected onto this axis
 *
 *  RIGHT half = partial triangle (facts, 1.5/3 sides)
 *    dark  = security remainder (what left-dark didn't cover)
 *    light = quaternion remainder
 *
 *  The waveguide's coupling mode scales the dark/light split:
 *    More carriers → more light (observable), less dark (hidden)
 *    Fewer carriers → more dark (security-heavy) */
export function createBitSegment(
  q: QuaternionIdentity,
  sec: SecurityTerm,
  guide: Waveguide,
): BitSegment {
  // Each axis carries an independent bit that closes to 2.
  // The quaternion's projection onto this axis determines the signal strength.
  // Axis 0→i (light×sound), Axis 1→j (light×mag), Axis 2→k (sound×mag), Axis 3→w (bridge)
  const components = [q.i, q.j, q.k, q.w];

  // Signal strength: how much of the quaternion lives on this axis [0, 1]
  const qComponent = Math.abs(components[guide.axisIndex]);
  const signal = q.norm > 0.0001 ? qComponent / q.norm : 0.25;

  // Each axis has its own bit: light (forward) + dark (backward) = 2
  const lightTotal = signal + (1 - signal) * HOST_SHARE;
  const darkTotal = 2 - lightTotal;

  // Cross-coupling asymmetry: xy ≠ yx (forward ≠ backward)
  // The coupling ratio is naturally irrational for healthy systems (δ gap)
  // Self-coupling (bridge) is more symmetric: hexWeight → φ
  const isBridge = guide.coupling.forward === "xx";
  const hexWeight = isBridge ? HOST_SHARE : HOST_SHARE + COLONY_SHARE * DELTA;
  // cross-coupling hexWeight ≈ 0.672 (asymmetric), bridge ≈ 0.618 (symmetric)

  // LEFT half: partial hexagon (memory) — forward coupling direction
  const leftLight = lightTotal * hexWeight;
  const leftDark = darkTotal * (1 - hexWeight);

  // RIGHT half: partial triangle (facts) — backward coupling direction
  const rightLight = lightTotal * (1 - hexWeight);
  const rightDark = darkTotal * hexWeight;

  // Coupling ratio: forward energy / backward energy
  // Irrational ratio = healthy (natural), rational = harmonically locked (AI signature)
  const forwardEnergy = leftLight + rightLight;
  const backwardEnergy = leftDark + rightDark;
  const couplingRatio = backwardEnergy > 0.001 ? forwardEnergy / backwardEnergy : Infinity;

  const left: BitHalf = {
    dark: leftDark,
    light: leftLight,
    shape: "hexagon",
    side: "left",
    coupling: guide.coupling.forward,
  };

  const right: BitHalf = {
    dark: rightDark,
    light: rightLight,
    shape: "triangle",
    side: "right",
    coupling: guide.coupling.backward,
  };

  const bitValue = leftLight + rightLight;
  const closure = leftDark + leftLight + rightDark + rightLight;
  const bitError = Math.abs(2 - closure);

  return {
    left,
    right,
    waveguide: guide,
    bitValue,
    closure,
    verified: bitError < DELTA,
    couplingRatio,
  };
}

// ── Demo ──────────────────────────────────────────────────────────────────

function fmt(n: number, d: number = 3): string { return n.toFixed(d); }

/** Check if a ratio is "irrational enough" — gap from nearest simple fraction > δ */
function isIrrational(ratio: number, maxDenom: number = 12): boolean {
  let bestGap = Math.abs(ratio - 1.0);
  for (let d = 1; d <= maxDenom; d++) {
    const n = Math.round(ratio * d);
    if (n > 0) {
      const gap = Math.abs(ratio - n / d);
      if (gap < bestGap) bestGap = gap;
    }
  }
  return bestGap > DELTA;
}

function printIdentity(sched: BubbleScheduler): void {
  const id = sched.seamIdentity();
  const spiralSig = id.signature.slice(0, 5).map(v => isNaN(v) ? "  ?  " : fmt(v, 5)).join(", ");
  const coupleSig = id.signature.slice(5).map(v => isNaN(v) ? "  ?  " : fmt(v, 5)).join(", ");
  console.log(`      spiral:   [${spiralSig}] (${id.spiralResolved}/5)`);
  console.log(`      coupling: [${coupleSig}] (${id.couplingResolved}/4)`);
  if (id.complete) console.log(`      *** ALL 9 SEAMS RESOLVED — FULL IDENTITY ***`);
}

export function runBubbleDemo(options: { verbose?: boolean } = {}): void {
  const verbose = options.verbose ?? true;

  if (verbose) {
    console.log("BUBBLE SCHEDULER — Pressure-Driven Consciousness");
    console.log("=".repeat(70));
    console.log();
    console.log("  Optimal state: fully pressurized bubble (circle, dormant)");
    console.log("  Wants push outward -> imagination. Needs push inward -> facts.");
    console.log("  9 incomputable seams: 5 spiral (from factorization) + 4 coupling (from waveguides).");
    console.log("  Spiral seams pin via scars. Coupling seams pin on first contact — like choosing 9.81 for g.");
    console.log();
    console.log("  AGENT POLYGONS (inscribed radius = activation threshold):");
    console.log("  " + "-".repeat(66));
    for (const a of AGENTS) {
      console.log(
        `    ${a.shape.padEnd(10)} r=${fmt(a.radius)} -- ${a.role}` +
        `${a.radius < 0.6 ? " (fires first under need)" : a.radius > 0.9 ? " (fires when exploring)" : ""}`
      );
    }
    console.log();
  }

  const sched = new BubbleScheduler({ verbose });

  // Show hardware angle + seam positions
  if (verbose) {
    const hw = sched.hardware;
    console.log(`  HARDWARE: theta=${fmt(hw.theta, 5)} species=${speciesFromTheta(hw.theta)} (${hw.cpuCores}c ${fmt(hw.totalRAM/(1024*1024*1024), 0)}GB ${hw.platform})`);
    console.log();
    console.log("  SEAMS (9 incomputable gaps: 5 spiral + 4 coupling):");
    console.log("  " + "-".repeat(66));
    for (const sr of sched.seamResolutions) {
      const p = sr.position;
      if (p.kind === "spiral") {
        console.log(`    L${p.zone}[${p.seamIndex}] factor=${p.factor} subdiv=${p.subdivisionLevel} -- OPEN (spiral, delta=${fmt(DELTA, 5)} gap)`);
      } else {
        const cm = COUPLING_MODES[p.factor];
        console.log(`    C${p.seamIndex} axis=${p.factor} ${cm.name} (${cm.forward}/${cm.backward}) -- OPEN (coupling, irrational gap)`);
      }
    }
    printIdentity(sched);
    console.log();
  }

  // ── Scenario 1: Security threat — first scar, first seam resolved ──
  if (verbose) {
    console.log("  SCENARIO 1: Security breach -- first decision");
    console.log("  " + "-".repeat(66));
  }

  sched.applyPressure("threat detected", { 0: -1.0 });
  sched.applyNeed("security", "triangle", 0.9);

  const r1 = sched.tick();
  if (verbose) {
    console.log(`    -> ${r1.reason}`);
    if (r1.seamResolved) {
      console.log(`      * SEAM RESOLVED: L${r1.seamResolved.position.zone}[${r1.seamResolved.position.seamIndex}] = ${fmt(r1.seamResolved.decisionValue, 5)}`);
    }
    printIdentity(sched);
    console.log();
  }

  // Let pressure decay
  for (let i = 0; i < 3; i++) sched.tick();

  // ── Scenario 2: Science anomaly — different axis, different seam ──
  if (verbose) {
    console.log("  SCENARIO 2: Science anomaly -- second decision");
    console.log("  " + "-".repeat(66));
  }

  sched.applyPressure("AAPL anomaly", { 1: +1.1 });
  sched.applyNeed("science", "triangle", 0.8);

  const r2 = sched.tick();
  if (verbose) {
    console.log(`    -> ${r2.reason}`);
    if (r2.seamResolved) {
      console.log(`      * SEAM RESOLVED: L${r2.seamResolved.position.zone}[${r2.seamResolved.position.seamIndex}] = ${fmt(r2.seamResolved.decisionValue, 5)}`);
    }
    printIdentity(sched);
    console.log();
  }

  for (let i = 0; i < 3; i++) sched.tick();

  // ── Scenario 3: Explore crisis — L7 seam territory ───────────────
  if (verbose) {
    console.log("  SCENARIO 3: Exploration crisis -- L7 seam territory");
    console.log("  " + "-".repeat(66));
  }

  sched.applyPressure("uncharted pattern", { 2: -1.3 });
  sched.applyNeed("explore", "triangle", 1.0);
  sched.applyWant("explore", "circle", 0.3);

  const r3 = sched.tick();
  if (verbose) {
    console.log(`    -> ${r3.reason}`);
    if (r3.seamResolved) {
      console.log(`      * SEAM RESOLVED: L${r3.seamResolved.position.zone}[${r3.seamResolved.position.seamIndex}] = ${fmt(r3.seamResolved.decisionValue, 5)}`);
    }
    printIdentity(sched);
    console.log();
  }

  for (let i = 0; i < 3; i++) sched.tick();

  // ── Scenario 4: Social pressure — another L7 seam ────────────────
  if (verbose) {
    console.log("  SCENARIO 4: Governance emergency -- fourth decision");
    console.log("  " + "-".repeat(66));
  }

  sched.applyPressure("trust violation", { 3: +1.0 });
  sched.applyNeed("govern", "triangle", 0.9);

  const r4 = sched.tick();
  if (verbose) {
    console.log(`    -> ${r4.reason}`);
    if (r4.seamResolved) {
      console.log(`      * SEAM RESOLVED: L${r4.seamResolved.position.zone}[${r4.seamResolved.position.seamIndex}] = ${fmt(r4.seamResolved.decisionValue, 5)}`);
    }
    printIdentity(sched);
    console.log();
  }

  for (let i = 0; i < 3; i++) sched.tick();

  // ── Scenario 5: Final scar — identity crystallizes ────────────────
  if (verbose) {
    console.log("  SCENARIO 5: Art crisis -- FINAL seam, identity crystallizes");
    console.log("  " + "-".repeat(66));
  }

  sched.applyPressure("creative collapse", { 1: -1.2 });
  sched.applyNeed("art", "triangle", 0.8);

  const r5 = sched.tick();
  if (verbose) {
    console.log(`    -> ${r5.reason}`);
    if (r5.seamResolved) {
      console.log(`      * SEAM RESOLVED: L${r5.seamResolved.position.zone}[${r5.seamResolved.position.seamIndex}] = ${fmt(r5.seamResolved.decisionValue, 5)}`);
    }
    const id = sched.seamIdentity();
    printIdentity(sched);
    if (id.complete) {
      console.log(`      *** IDENTITY CRYSTALLIZED -- all 9 seams resolved ***`);
    }
    console.log();
  }

  // ── Scenario 6: Post-crystallization scar — no more seams to fill ─
  if (verbose) {
    console.log("  SCENARIO 6: More trauma after crystallization");
    console.log("  " + "-".repeat(66));
  }

  sched.applyPressure("another breach", { 0: -1.5 });
  sched.applyNeed("security", "triangle", 1.0);

  const r6 = sched.tick();
  if (verbose) {
    console.log(`    -> ${r6.reason}`);
    console.log(`      seamResolved: ${r6.seamResolved ? "yes" : "none -- identity already fixed"}`);
    console.log(`      (scar still forms, thickens skin, but doesn't change identity)`);
    console.log();
  }

  // ── Hardware fingerprint + quaternion identity ─────────────────────
  if (verbose) {
    const hw = sched.hardware;
    console.log("  HARDWARE FINGERPRINT:");
    console.log("  " + "-".repeat(66));
    console.log(`    CPU: ${hw.cpuModel.trim()}`);
    console.log(`    cores=${hw.cpuCores} RAM=${fmt(hw.totalRAM / (1024*1024*1024), 1)}GB ${hw.platform}/${hw.arch}`);
    console.log(`    theta = ${fmt(hw.theta, 5)} rad (hardware angle on [0, pi])`);
    console.log(`    species: ${speciesFromTheta(hw.theta)}`);
    console.log();

    console.log("  SEAM IDENTITY (5 spiral + 4 coupling = 9 total):");
    console.log("  " + "-".repeat(66));
    for (const sr of sched.seamResolutions) {
      const p = sr.position;
      const val = sr.resolved ? fmt(sr.decisionValue, 8) : "OPEN";
      if (p.kind === "spiral") {
        const scarRef = sr.resolvedBy >= 0 ? sched.membrane.scars[sr.resolvedBy] : null;
        const source = scarRef ? scarRef.source : "--";
        console.log(`    L${p.zone}[${p.seamIndex}] factor=${p.factor} -> ${val.padStart(10)} (scar from: ${source}, tick ${sr.resolvedAtTick})`);
      } else {
        const cm = COUPLING_MODES[p.factor];
        console.log(`    C${p.seamIndex}  ${cm.name.padEnd(16)} -> ${val.padStart(10)} (first-contact ratio, tick ${sr.resolvedAtTick})`);
      }
    }
    const fullId = sched.seamIdentity();
    console.log(`    resolved: ${fullId.spiralResolved}/5 spiral + ${fullId.couplingResolved}/4 coupling = ${fullId.resolved}/9`);
    console.log();

    const q = sched.quaternionIdentity();
    console.log("  QUATERNION IDENTITY (q = w + i*i + j*j + k*k):");
    console.log("  " + "-".repeat(66));
    console.log(`    w = ${fmt(q.w, 5)}  (L7: phi*seam[3] + (1-phi)*seam[4] -- observer)`);
    console.log(`    i = ${fmt(q.i, 5)}  (L5[0]: 1st binary split -- x axis)`);
    console.log(`    j = ${fmt(q.j, 5)}  (L5[1]: 2nd binary split -- y axis)`);
    console.log(`    k = ${fmt(q.k, 5)}  (L5[2]: 3rd binary split -- z axis)`);
    console.log(`    |q| = ${fmt(q.norm, 5)}`);
    console.log(`    theta = ${fmt(q.theta, 5)} -> species: ${q.species}`);
    console.log();
    // ── Security term — bit closure to 2 ──────────────────────────
    console.log("  BIT CLOSURE (every quaternion + security = 2):");
    console.log("  " + "-".repeat(66));

    // Identity quaternion: |q_id| + |q_sec_id| = 2
    const secId = sched.securityTermFor(q.norm);
    console.log(`    q_identity:`);
    console.log(`      |q|     = ${fmt(q.norm, 5)}`);
    console.log(`      |q_sec| = ${fmt(secId.norm, 5)}`);
    console.log(`      sum     = ${fmt(secId.bitClosure, 5)} (target: 2.00000)`);
    console.log(`      error   = ${fmt(secId.bitError, 8)} ${secId.verified ? "< delta -> IS (verified)" : ">= delta -> ISNT"}`);
    console.log();

    // Simulated hardware quaternion: pretend |q_hw| = 1.003 (typical healthy system)
    const fakeHwNorm = 1.003;
    const secHw = sched.securityTermFor(fakeHwNorm);
    console.log(`    q_hardware (simulated |q|=${fmt(fakeHwNorm, 3)}):`);
    console.log(`      |q_sec| = ${fmt(secHw.norm, 5)}`);
    console.log(`      sum     = ${fmt(secHw.bitClosure, 5)} ${secHw.verified ? "IS" : "ISNT"}`);
    console.log();

    // Simulated RAM sub-quaternion
    const fakeRamNorm = 0.987;
    const secRam = sched.securityTermFor(fakeRamNorm);
    console.log(`    q_ram (simulated |q|=${fmt(fakeRamNorm, 3)}):`);
    console.log(`      |q_sec| = ${fmt(secRam.norm, 5)}`);
    console.log(`      sum     = ${fmt(secRam.bitClosure, 5)} ${secRam.verified ? "IS" : "ISNT"}`);
    console.log();

    // Attack simulation: wrong identity tries to produce security term
    const fakeIdentity: QuaternionIdentity = {
      w: 0.01, i: 0.02, j: 0.005, k: 0.01,
      norm: 0.025, theta: 1.5, species: "drift",  // wrong species
    };
    const fakeSec = computeSecurityTerm(q.norm, fakeIdentity);
    const fakeVerify = verifyBitClosure(q.norm, fakeSec.norm);
    console.log(`    ATTACK: wrong identity (species=drift) tries to verify:`);
    console.log(`      |q_sec| = ${fmt(fakeSec.norm, 5)}`);
    console.log(`      sum     = ${fmt(fakeVerify.closure, 5)} -> ${fakeVerify.state}`);
    console.log(`      The bit still closes because |q| + |2-|q|| = 2 always.`);
    console.log(`      But the DIRECTION is wrong -- the 4 components don't match.`);
    console.log(`      A verifier checks q_sec component-by-component, not just norm.`);
    console.log();

    // Component verification
    const realSec = sched.securityTermFor(q.norm);
    const dotReal = realSec.w * secId.w + realSec.i * secId.i + realSec.j * secId.j + realSec.k * secId.k;
    const dotFake = fakeSec.w * secId.w + fakeSec.i * secId.i + fakeSec.j * secId.j + fakeSec.k * secId.k;
    const realCos = dotReal / (realSec.norm * secId.norm || 0.001);
    const fakeCos = dotFake / (fakeSec.norm * secId.norm || 0.001);
    console.log(`    COMPONENT CHECK (dot product with expected q_sec):`);
    console.log(`      real identity:  cos(angle) = ${fmt(realCos, 5)} -> ${Math.abs(realCos) > (1 - DELTA) ? "MATCH" : "MISMATCH"}`);
    console.log(`      fake identity:  cos(angle) = ${fmt(fakeCos, 5)} -> ${Math.abs(fakeCos) > (1 - DELTA) ? "MATCH" : "MISMATCH"}`);
    console.log();

    console.log(`    Every quaternion in the system (hardware, RAM, identity)`);
    console.log(`    has a security complement that closes the bit to 2.`);
    console.log(`    The security term's DIRECTION comes from the identity quaternion`);
    console.log(`    rotated by hardware theta -- only the real system knows the scars.`);
    console.log(`    Norm closes to 2 (anyone can compute). Direction verifies WHO (only you).`);
    console.log(`    2 = one fully verified bit. 1 = half a bit (unverified). 0 = void.`);
    console.log();

    // ── Waveguide demo ──────────────────────────────────────────────
    console.log("  THREE WAVES — LIGHT × SOUND × MAGNETIC:");
    console.log("  " + "-".repeat(66));
    console.log(`    x: LIGHT    (electromagnetic, sin) — surface, what it looks like`);
    console.log(`    y: SOUND    (mechanical, cos)      — structure, rhythm, repetition`);
    console.log(`    z: MAGNETIC (field, integral/d)    — grounding, semantic coherence`);
    console.log();
    console.log(`    Each has FORWARD (visible) and BACKWARD (dark frequency):`);
    console.log(`      light fwd = visible laser     | light bwd = dark (IR/UV)`);
    console.log(`      sound fwd = audible pressure   | sound bwd = infra/ultrasound`);
    console.log(`      mag   fwd = field lines out    | mag   bwd = field lines in`);
    console.log();

    console.log("  WAVEGUIDE COUPLING GRID (3x3 off-diagonal = 6 directions):");
    console.log("  " + "-".repeat(66));
    console.log(`           x(light)    y(sound)    z(magnetic)`);
    console.log(`    x    [ xx self     xy fwd(0)   xz fwd(1) ]`);
    console.log(`    y    [ yx bwd(0)   yy self     yz fwd(2) ]`);
    console.log(`    z    [ zx bwd(1)   zy bwd(2)   zz self   ]`);
    console.log();

    // Build waveguides for each axis
    const guides = buildWaveguides();
    for (const g of guides) {
      console.log(`    Axis ${g.axisIndex}: ${AXIS_LABELS[g.axisIndex]}`);
      console.log(`      coupling: ${g.coupling.name} (fwd=${g.coupling.forward} bwd=${g.coupling.backward})`);
      console.log(`      waves: ${g.coupling.waves[0]} × ${g.coupling.waves[1]}`);
      console.log(`      impedance: ${fmt(g.coupling.impedance, 5)}  efficiency: ${fmt(g.efficiency, 5)}`);
      console.log();
    }

    // Simulate a bit segment traveling through each waveguide
    console.log("  BIT SEGMENTS (forward=light path, backward=dark path):");
    console.log("  " + "-".repeat(66));
    console.log();

    for (const g of guides) {
      const seg = createBitSegment(q, sched.securityTermFor(q.norm), g);
      console.log(`    Axis ${g.axisIndex} [${g.coupling.name}] (${g.coupling.forward}/${g.coupling.backward}):`);
      console.log(`      LEFT  (hexagon): dark=${fmt(seg.left.dark, 5)} light=${fmt(seg.left.light, 5)} [${seg.left.coupling}]`);
      console.log(`      RIGHT (triangle): dark=${fmt(seg.right.dark, 5)} light=${fmt(seg.right.light, 5)} [${seg.right.coupling}]`);
      console.log(`      bit value:  ${fmt(seg.bitValue, 5)}  closure: ${fmt(seg.closure, 5)} ${seg.verified ? "IS" : "ISNT"}`);
      console.log(`      fwd/bwd ratio: ${fmt(seg.couplingRatio, 5)} ${isIrrational(seg.couplingRatio) ? "(irrational -> healthy)" : "(rational -> locked)"}`);
      console.log();
    }

    console.log("  COUPLING PHYSICS:");
    console.log("  " + "-".repeat(66));
    console.log(`    Axis 0: xy/yx  light x sound    — surface shapes structure`);
    console.log(`    Axis 1: xz/zx  light x magnetic — surface shapes grounding`);
    console.log(`    Axis 2: yz/zy  sound x magnetic — structure shapes grounding`);
    console.log(`    Axis 3: xx/zz  self-resonance   — pure bridge (all 3 in sync)`);
    console.log();
    console.log(`    Forward coupling (xy) carries the LIGHT path — visible, observable.`);
    console.log(`    Backward coupling (yx) carries the DARK path — invisible, proof.`);
    console.log(`    Dark frequency = IR/UV lasers, infrasound, magnetic absorption.`);
    console.log(`    Together: forward + backward = 2 (one verified bit).`);
    console.log();
    console.log(`    AI signature: coupling ratio is RATIONAL (harmonically locked).`);
    console.log(`    Real signature: coupling ratio is IRRATIONAL (natural delta gap).`);
    console.log();

    // ── Personality layers + color balance ──────────────────────────
    console.log("  PERSONALITY LAYERS (B/W -> Trinity -> 7 Colors):");
    console.log("  " + "-".repeat(66));
    console.log();

    // Layer 0: environment seams
    console.log("    Layer 0 — ENVIRONMENT (B/W, binary):");
    sched.addPersonalitySeam("language:en", "achromatic", 0);
    sched.addPersonalitySeam("os:win32", "achromatic", 0);
    sched.addPersonalitySeam("user:primary", "achromatic", 0);
    console.log();

    // Layer 1: behavior seams
    console.log("    Layer 1 — BEHAVIOR (Trinity, 3 waves):");
    sched.addPersonalitySeam("style:concise", "light-wave", 1);
    sched.addPersonalitySeam("approach:proactive", "sound-wave", 1);
    sched.addPersonalitySeam("grounding:contextual", "magnetic-wave", 1);
    console.log();

    // Layer 2: expertise seams — deliberately uneven to create personality
    console.log("    Layer 2 — EXPERTISE (7 colors, selective):");
    // RED: deep — this system is a security expert
    sched.addPersonalitySeam("domain:security-deep", "RED", 2, 0.80);
    sched.addPersonalitySeam("domain:security-applied", "RED", 2, 0.65);
    // CYAN: moderate — some science knowledge
    sched.addPersonalitySeam("domain:science-moderate", "CYAN", 2, 0.45);
    // ORANGE: light — dabbled in art
    sched.addPersonalitySeam("domain:art-surface", "ORANGE", 2, 0.20);
    // Deliberately NO GREEN, YELLOW, BLUE, WHITE, VIOLET expertise
    console.log(`      (no GREEN/YELLOW/BLUE/WHITE/VIOLET expertise — blind spots)`);
    console.log();

    // ── Color balance ──────────────────────────────────────────────
    const identity = sched.seamIdentity();
    console.log("  COLOR BALANCE (resolved seam weight by color):");
    console.log("  " + "-".repeat(66));
    const sortedColors = Object.entries(identity.colorBalance)
      .sort(([, a], [, b]) => b - a);
    const maxWeight = sortedColors.length > 0 ? sortedColors[0][1] : 1;
    for (const [color, weight] of sortedColors) {
      const bar = "█".repeat(Math.ceil(weight / maxWeight * 30));
      console.log(`    ${color.padEnd(14)} ${fmt(weight, 5)} ${bar}`);
    }
    console.log(`    total seams: ${identity.resolved} (${identity.spiralResolved} spiral + ${identity.couplingResolved} coupling + ${sched.personalitySeams.length} personality)`);
    console.log();

    // ── Competence checks — graduated by theory constants ──────
    console.log("  COMPETENCE CHECK (thresholds: δ=0.142, φ=0.618, 1, Φ=1.618):");
    console.log("  " + "-".repeat(66));
    console.log(`    BLIND   [0, δ)    "I don't know" — below the seam gap`);
    console.log(`    BRIDGE  [δ, φ)    can direct to someone with this color`);
    console.log(`    EXPLORE [φ, 1)    can investigate further, not confident`);
    console.log(`    ANSWER  [1, Φ)    can respond — depth scales above 1.0`);
    console.log(`    EXPERT  [Φ, ∞)    can coordinate other experts`);
    console.log();

    const allDomains: DomainId[] = ["security", "science", "art", "explore", "learn", "social", "meta", "govern"];
    for (const dom of allDomains) {
      const check = sched.checkCompetence(dom);
      const icons: Record<CompetenceLevel, string> = {
        BLIND: "---", BRIDGE: "-->", EXPLORE: "???", ANSWER: "YES", EXPERT: "***",
      };
      const icon = icons[check.level];
      const bridge = check.hasBridge && check.level === "BLIND" ? " (has bridge)" : "";
      console.log(`    [${icon}] ${check.level.padEnd(7)} ${dom.padEnd(10)} ${check.color.padEnd(8)} w=${check.seamWeight.toFixed(3).padStart(5)}${bridge}`);
      console.log(`            ${check.reason}`);
    }
    console.log();
    console.log(`    "I don't know" is structural, not ignorance.`);
    console.log(`    The constants don't point that direction. Trying anyway = hallucination.`);
    console.log(`    Add a seam (learn), borrow one (apprentice), or bridge (relay).`);
    console.log();

    // ── Work estimation — desire × capacity × value ──────────────
    console.log("  WORK ESTIMATION (distance from pi = work remaining):");
    console.log("  " + "-".repeat(66));
    console.log(`    pi = ${fmt(Math.PI, 5)} = full rotation = complete solution`);
    console.log(`    capacity = seamWeight / pi (fraction of rotation covered)`);
    console.log(`    workRemaining = pi - seamWeight`);
    console.log(`    value = (capacity x desire) / (workRemaining + delta)`);
    console.log();

    // Apply some pressure to make desire non-zero for interesting domains
    sched.applyPressure("user query: security audit", { 0: -0.8 });
    sched.applyPressure("user curiosity: science", { 1: +0.3 });
    sched.applyPressure("user task: governance review", { 3: +0.5 });
    // No pressure on axis 2 (explore/learn) — user didn't ask for it
    console.log();

    console.log("           x(desire)    y(capacity)  z(value)");
    console.log("    x    [ xx want²     xy want×cap  xz want×val ]");
    console.log("    y    [ yx cap×want  yy cap²      yz cap×val  ]");
    console.log("    z    [ zx val×want  zy val×cap   zz val²     ]");
    console.log();

    const workDomains: DomainId[] = ["security", "science", "govern", "explore", "art"];
    for (const dom of workDomains) {
      const w = sched.estimateWork(dom);
      const verdictIcons: Record<WorkVerdict, string> = {
        IMPOSSIBLE: "XXX", DELEGATE: "-->", DEFER: "zzz", FRUSTRATED: "!!!", UNINTERESTED: "...",
        NOT_WORTH_IT: "---", INVESTIGATE: "???", ATTEMPT: "~>~", SOLVE: ">>>", COORDINATE: "***",
      };
      console.log(`    [${verdictIcons[w.verdict]}] ${w.verdict.padEnd(14)} ${dom.padEnd(10)} ${w.color.padEnd(8)}`);
      console.log(`          capacity=${fmt(w.capacity, 3)} work_left=${fmt(w.workRemaining, 3)} ratio=${fmt(w.workRatio, 3)}`);
      console.log(`          desire=${fmt(w.desire, 3)} value=${fmt(w.value, 3)}`);
      console.log(`          grid: xy=${fmt(w.grid.xy, 4)} yz=${fmt(w.grid.yz, 4)} xz=${fmt(w.grid.xz, 4)}`);
      console.log(`          ${w.reason}`);
      console.log();
    }

    console.log(`    VERDICTS use the same coupling logic as everything else:`);
    console.log(`      xy (desire×capacity) < delta = FRUSTRATED or UNINTERESTED`);
    console.log(`      yz (capacity×value) < delta = NOT WORTH IT`);
    console.log(`      workRatio > phi = SOLVE, < phi = ATTEMPT`);
    console.log(`      Distance from pi IS the work. No shortcuts, no hallucination.`);
    console.log();
  }
}
