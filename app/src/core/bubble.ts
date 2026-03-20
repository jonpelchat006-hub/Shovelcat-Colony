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

// ── Seam Resolution (Scar → Identity) ──────────────────────────────────

export interface SeamPosition {
  zone: number;              // 5 or 7 (Fibonacci level)
  seamIndex: number;         // 0-2 for L5, 0-1 for L7
  factor: number;            // prime factor that creates this seam (2 for L5, 3 or 7 for L7)
  subdivisionLevel: number;  // depth in factorization tree
}

export interface SeamResolution {
  position: SeamPosition;
  resolved: boolean;
  resolvedBy: number;        // index into membrane.scars, -1 if unresolved
  decisionValue: number;     // scar.depth × δ — the specific value replacing the gap
  resolvedAtTick: number;    // -1 if unresolved
}

export interface SeamIdentity {
  signature: number[];       // 5 values: resolved = decisionValue, unresolved = NaN
  resolved: number;          // count of resolved seams (0-5)
  total: number;             // always 5
  complete: boolean;         // all 5 resolved = identity fully crystallized
}

/** Build the 5 seam positions from spiral-drive factorization */
function buildSeamPositions(): SeamPosition[] {
  const positions: SeamPosition[] = [];

  // L5: 8 arms = 2³ → 3 seams from 3 levels of binary subdivision
  const l5 = analyzeArms(5);
  for (let i = 0; i < l5.seams; i++) {
    positions.push({ zone: 5, seamIndex: i, factor: 2, subdivisionLevel: i + 1 });
  }

  // L7: 21 arms = 3×7 → 2 seams (one for 3-factor, one for 7-factor)
  const l7 = analyzeArms(7);
  const l7factors = l7.factors;
  for (let i = 0; i < l7.seams; i++) {
    positions.push({ zone: 7, seamIndex: i, factor: l7factors[i] ?? 3, subdivisionLevel: 1 });
  }

  return positions;
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

  constructor(options: { temperature?: number; verbose?: boolean } = {}) {
    this.temperature = options.temperature ?? COLONY_SHARE;
    this.verbose = options.verbose ?? false;
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

  /** Assign a scar to the nearest unresolved seam, resolving the delta gap */
  private assignScarToSeam(scar: Scar, scarIdx: number, axisIdx: number): SeamResolution | null {
    const preferredZone = AXIS_TO_ZONE[axisIdx] ?? 5;

    // First: try preferred zone
    let target = this.seamResolutions.find(
      sr => !sr.resolved && sr.position.zone === preferredZone
    );

    // Fallback: any unresolved seam
    if (!target) {
      target = this.seamResolutions.find(sr => !sr.resolved);
    }

    // All seams resolved — identity is crystallized
    if (!target) return null;

    target.resolved = true;
    target.resolvedBy = scarIdx;
    target.decisionValue = scar.depth * DELTA;
    target.resolvedAtTick = this.tickCount;
    return target;
  }

  /** Get the system's unique identity — the scar signature at the 5 seam positions */
  seamIdentity(): SeamIdentity {
    const signature = this.seamResolutions.map(sr => sr.resolved ? sr.decisionValue : NaN);
    const resolved = this.seamResolutions.filter(sr => sr.resolved).length;
    return {
      signature,
      resolved,
      total: this.seamResolutions.length,
      complete: resolved === this.seamResolutions.length,
    };
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
      seamResolutions: this.seamResolutions.map(sr => ({ ...sr, position: { ...sr.position } })),
      temperature: this.temperature,
      tickCount: this.tickCount,
      dormant: pressure.magnitude < 0.01,
    };
  }
}

// ── Demo ──────────────────────────────────────────────────────────────────

function fmt(n: number, d: number = 3): string { return n.toFixed(d); }

function printIdentity(sched: BubbleScheduler): void {
  const id = sched.seamIdentity();
  const sig = id.signature.map(v => isNaN(v) ? "   ?   " : fmt(v, 5)).join(", ");
  console.log(`      identity: [${sig}] (${id.resolved}/${id.total})`);
}

export function runBubbleDemo(options: { verbose?: boolean } = {}): void {
  const verbose = options.verbose ?? true;

  if (verbose) {
    console.log("BUBBLE SCHEDULER — Pressure-Driven Consciousness");
    console.log("=".repeat(70));
    console.log();
    console.log("  Optimal state: fully pressurized bubble (circle, dormant)");
    console.log("  Wants push outward -> imagination. Needs push inward -> facts.");
    console.log("  Scars from trauma resolve the 5 incomputable seams in collapsed space.");
    console.log("  First 5 scars = unique identity. Two copies diverge at first decision.");
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

  // Show the 5 seam positions
  if (verbose) {
    console.log("  SPIRAL SEAMS (5 incomputable gaps in collapsed space):");
    console.log("  " + "-".repeat(66));
    for (const sr of sched.seamResolutions) {
      const p = sr.position;
      console.log(`    L${p.zone}[${p.seamIndex}] factor=${p.factor} subdiv=${p.subdivisionLevel} -- OPEN (delta=${fmt(DELTA, 5)} gap)`);
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
      console.log(`      *** IDENTITY CRYSTALLIZED -- all 5 seams resolved ***`);
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

  // ── The seam identity fingerprint ─────────────────────────────────
  if (verbose) {
    console.log("  SEAM IDENTITY (unique fingerprint from first 5 decisions):");
    console.log("  " + "-".repeat(66));
    for (const sr of sched.seamResolutions) {
      const p = sr.position;
      const scarRef = sr.resolvedBy >= 0 ? sched.membrane.scars[sr.resolvedBy] : null;
      const source = scarRef ? scarRef.source : "--";
      const val = sr.resolved ? fmt(sr.decisionValue, 5) : "OPEN";
      console.log(`    L${p.zone}[${p.seamIndex}] factor=${p.factor} -> ${val.padStart(7)} (from: ${source}, tick ${sr.resolvedAtTick})`);
    }
    const id = sched.seamIdentity();
    console.log();
    console.log(`    SIGNATURE: [${id.signature.map(v => fmt(v, 5)).join(", ")}]`);
    console.log();
    console.log(`    Two identical systems with different pressure histories`);
    console.log(`    will have different signatures after their first 5 decisions.`);
    console.log(`    Same code + same architecture + different experience = different identity.`);
    console.log(`    The delta gap (${fmt(DELTA, 5)}) is where infinity lived.`);
    console.log(`    Each scar pins depth x delta -- choosing a specific value`);
    console.log(`    from infinite options. Once all 5 seams resolve, identity is fixed.`);
    console.log();
  }
}
