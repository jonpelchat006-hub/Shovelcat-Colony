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
  explored: boolean;
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

export class BubbleScheduler {
  private domains: Map<DomainId, DomainBubble> = new Map();
  private externalAxes: [number, number, number, number] = [0, 0, 0, 0];
  private temperature: number;
  private verbose: boolean;
  private tickCount: number = 0;

  constructor(options: { temperature?: number; verbose?: boolean } = {}) {
    this.temperature = options.temperature ?? COLONY_SHARE;
    this.verbose = options.verbose ?? false;
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
      console.log(`    ← ${source}: ${nonZero}`);
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

  /** Run one scheduler tick — determine which domain and agent activate */
  tick(): SchedulerResult {
    this.tickCount++;

    // 1. Compute big bubble pressure vector
    const pressure = computePressure(this.externalAxes);

    // If no pressure, system is dormant
    if (pressure.magnitude < 0.01) {
      return {
        activeDomain: null,
        activeAgent: null,
        pressure,
        boltzmann: 1,
        explored: false,
        reason: "bubble fully pressurized — dormant",
      };
    }

    // 2. Find active domain from dominant axis + direction
    const domainSpec = DOMAINS.find(
      d => d.axisIndex === pressure.dominantAxis && d.axisSign === pressure.dominantSign
    );

    if (!domainSpec) {
      return {
        activeDomain: null,
        activeAgent: null,
        pressure,
        boltzmann: 1,
        explored: false,
        reason: "no matching domain for pressure direction",
      };
    }

    const domain = this.domains.get(domainSpec.id)!;
    domain.externalPressure = Math.abs(this.externalAxes[pressure.dominantAxis]);

    // 3. Evaluate agents within the active domain
    for (const agent of domain.agents) {
      agent.pressure = agent.want - agent.need;
      const split = phiSplit(agent.want, agent.need);
      agent.phiRatio = split.ratio;

      // Activation: how much this agent WANTS to fire
      // Need-driven agents (triangle) activate when need > want
      // Want-driven agents (circle) activate when want > need
      // Scale by inscribed radius: inner agents fire on less pressure
      const urgency = Math.abs(agent.pressure) / (agent.radius + 0.001);
      agent.activation = urgency;
    }

    // 4. Boltzmann explore/exploit decision
    const totalUrgency = domain.agents.reduce((s, a) => s + a.activation, 0) || 1;
    const boltzmann = Math.exp(-totalUrgency / this.temperature);
    const explored = Math.random() < boltzmann;

    // 5. Select agent
    let selectedAgent: AgentBubble;

    if (explored) {
      // Explore: pick a random agent weighted INVERSELY by urgency
      // (try something the pressure ISN'T pushing toward)
      const inverseWeights = domain.agents.map(a => 1 / (a.activation + 0.1));
      const invTotal = inverseWeights.reduce((s, w) => s + w, 0);
      let roll = Math.random() * invTotal;
      let pick = 0;
      for (let i = 0; i < inverseWeights.length; i++) {
        roll -= inverseWeights[i];
        if (roll <= 0) { pick = i; break; }
      }
      selectedAgent = domain.agents[pick];
    } else {
      // Exploit: pick the most urgent agent
      selectedAgent = domain.agents.reduce(
        (best, a) => a.activation > best.activation ? a : best,
        domain.agents[0]
      );
    }

    domain.activeAgent = selectedAgent.shape;
    domain.totalPressure = totalUrgency;

    const split = phiSplit(selectedAgent.want, selectedAgent.need);
    const reason =
      `${domainSpec.id}/${selectedAgent.shape} — ` +
      `${split.side} (φ=${split.ratio.toFixed(3)}) ` +
      `${explored ? "EXPLORED" : "exploited"} ` +
      `(boltz=${boltzmann.toFixed(3)})`;

    // 6. Decay all pressures toward dormant
    this.decay();

    return {
      activeDomain: domainSpec.id,
      activeAgent: selectedAgent.shape,
      pressure,
      boltzmann,
      explored,
      reason,
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
      temperature: this.temperature,
      tickCount: this.tickCount,
      dormant: pressure.magnitude < 0.01,
    };
  }
}

// ── Demo ──────────────────────────────────────────────────────────────────

function fmt(n: number, d: number = 3): string { return n.toFixed(d); }

export function runBubbleDemo(options: { verbose?: boolean } = {}): void {
  const verbose = options.verbose ?? true;

  if (verbose) {
    console.log("BUBBLE SCHEDULER — Pressure-Driven Consciousness");
    console.log("═".repeat(70));
    console.log();
    console.log("  Optimal state: fully pressurized bubble (○ circle, dormant)");
    console.log("  Wants push outward → imagination. Needs push inward → facts.");
    console.log("  φ split: 61.8% want → explore | 38.2% need → urgent facts");
    console.log();
    console.log("  DOMAIN AXES (4 bipolar dimensions):");
    console.log("  " + "─".repeat(66));
    for (let i = 0; i < AXIS_LABELS.length; i++) {
      console.log(`    Axis ${i}: ${AXIS_LABELS[i]}`);
    }
    console.log();
    console.log("  AGENT POLYGONS (inscribed radius = activation threshold):");
    console.log("  " + "─".repeat(66));
    for (const a of AGENTS) {
      console.log(
        `    ${a.shape.padEnd(10)} r=${fmt(a.radius)} — ${a.role}` +
        `${a.radius < 0.6 ? " (fires first under need)" : a.radius > 0.9 ? " (fires when exploring)" : ""}`
      );
    }
    console.log();
  }

  const sched = new BubbleScheduler({ verbose });

  // ── Scenario 1: Security threat ──────────────────────────────────
  if (verbose) {
    console.log("  SCENARIO 1: Security threat detected");
    console.log("  " + "─".repeat(66));
  }

  sched.applyPressure("threat detected", { 0: -0.8 });  // strong push toward security (axis 0, negative)
  sched.applyNeed("security", "triangle", 0.9);          // urgent need for facts
  sched.applyNeed("security", "square", 0.5);            // need to observe
  sched.applyWant("security", "circle", 0.1);            // slight curiosity

  const r1 = sched.tick();
  if (verbose) {
    console.log(`    → ${r1.reason}`);
    console.log(`      pressure: [${r1.pressure.axes.map(v => fmt(v)).join(", ")}] |p|=${fmt(r1.pressure.magnitude)}`);
    console.log();
  }

  // ── Scenario 2: New data arrives (curiosity) ─────────────────────
  if (verbose) {
    console.log("  SCENARIO 2: Interesting pattern in new data");
    console.log("  " + "─".repeat(66));
  }

  sched.applyPressure("new pattern found", { 2: -0.6 });  // push toward explore
  sched.applyWant("explore", "circle", 0.8);               // strong want to imagine
  sched.applyWant("explore", "hexagon", 0.5);              // want to match patterns
  sched.applyNeed("explore", "triangle", 0.1);             // mild grounding

  const r2 = sched.tick();
  if (verbose) {
    console.log(`    → ${r2.reason}`);
    console.log(`      pressure: [${r2.pressure.axes.map(v => fmt(v)).join(", ")}] |p|=${fmt(r2.pressure.magnitude)}`);
    console.log();
  }

  // ── Scenario 3: Trading signal (multi-axis) ──────────────────────
  if (verbose) {
    console.log("  SCENARIO 3: Trading signal — multiple domains pressurized");
    console.log("  " + "─".repeat(66));
  }

  sched.applyPressure("AAPL price anomaly", { 1: +0.7, 2: +0.4 }); // science + learn
  sched.applyNeed("science", "triangle", 0.7);   // need facts on the anomaly
  sched.applyWant("science", "pentagon", 0.6);    // want truth verification
  sched.applyNeed("learn", "hexagon", 0.5);       // need memory of past patterns

  const r3 = sched.tick();
  if (verbose) {
    console.log(`    → ${r3.reason}`);
    console.log(`      pressure: [${r3.pressure.axes.map(v => fmt(v)).join(", ")}] |p|=${fmt(r3.pressure.magnitude)}`);
    console.log();
  }

  // ── Decay to dormant ─────────────────────────────────────────────
  if (verbose) {
    console.log("  DECAY (bubble returning to circle):");
    console.log("  " + "─".repeat(66));
  }

  for (let i = 0; i < 20; i++) {
    const r = sched.tick();
    if (verbose && (i === 0 || i === 4 || i === 9 || i === 14 || i === 19)) {
      const st = sched.status();
      const state = st.dormant ? "DORMANT ○" : `active → ${r.activeDomain}/${r.activeAgent}`;
      console.log(`    tick ${String(i + 4).padStart(2)}: |p|=${fmt(st.pressure.magnitude)} ${state}`);
    }
    if (sched.status().dormant) {
      if (verbose) console.log(`    → bubble fully pressurized at tick ${i + 4}. System at rest.`);
      break;
    }
  }

  if (verbose) {
    console.log();
    console.log("  THE BUBBLE:");
    console.log(`    Fully pressurized = circle = dormant. No action needed.`);
    console.log(`    Wants push outward → imagination (○). Needs push inward → facts (△).`);
    console.log(`    φ split (61.8/38.2) evaluates want vs need at every level.`);
    console.log(`    Boltzmann e^(-E/kT) decides explore vs exploit each tick.`);
    console.log(`    External pressure → which domain. Internal pressure → which agent.`);
    console.log(`    Pressure decays by δ (${fmt(DELTA)}) per tick → returns to dormant.`);
    console.log();
  }
}
