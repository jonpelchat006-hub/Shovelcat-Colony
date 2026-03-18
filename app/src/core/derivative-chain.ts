/**
 * DERIVATIVE CHAIN ENGINE — The Core of the Spore
 * ================================================
 *
 * The four hardware tiers form a derivative chain:
 *
 *   Tier 0: DISK   = x           (field, stored potential)
 *   Tier 1: RAM    = dx/dt       (velocity, data in motion)
 *   Tier 2: CPU    = d²x/dt²    (acceleration, transformation)
 *   Tier 3: VRAM   = observer    (collapse into output)
 *
 * This engine:
 *   1. Samples all four tiers simultaneously
 *   2. Computes derivatives (velocity, acceleration) from the history
 *   3. Predicts future state at each tier
 *   4. Recommends actions (prestage, evict, go dormant)
 *
 * The engine has ZERO dependencies beyond the platform sampler.
 * It is the blank spore — it makes any system faster just by existing.
 *
 * Author: Jonathan Pelchat
 * Shovelcat Theory — The Derivative Chain
 */

import { getSampler, type PlatformSampler, type GPUStats, type RAMStats } from "./sampler";
import { computeHardwareQuaternion, getThetaPhase } from "./quaternion-chain";

// ── Constants ────────────────────────────────────────────────────────────

const PHI = 1.618033988749895;
const HOST_SHARE = PHI / (1 + PHI);     // ≈ 0.618
const COLONY_SHARE = 1 / (1 + PHI);     // ≈ 0.382

// ── Types ────────────────────────────────────────────────────────────────

/** Snapshot of all four tiers at one moment */
export interface ChainSnapshot {
  timestamp: number;
  // Tier 0: Disk (field)
  diskReadMBps: number;
  diskWriteMBps: number;
  // Tier 1: RAM (velocity)
  ramTotalMB: number;
  ramAvailableMB: number;
  ramUsedMB: number;
  ramBandwidthMBps: number;  // estimated from delta
  // Tier 2: CPU (acceleration)
  cpuCores: number;
  cpuThreads: number;
  // Tier 3: VRAM (observer)
  vramAvailable: boolean;
  vramTotalMB: number;
  vramUsedMB: number;
  vramFreeMB: number;
  vramUtilPct: number;
}

/** Derivatives computed from consecutive snapshots */
export interface ChainDerivatives {
  // First derivatives (velocity of each tier)
  ramVelocityMBps: number;       // rate of RAM usage change
  vramVelocityMBps: number;      // rate of VRAM usage change
  // Second derivatives (acceleration)
  ramAccelMBps2: number;         // acceleration of RAM usage
  vramAccelMBps2: number;        // acceleration of VRAM usage
}

/** Prediction for a future time point */
export interface ChainPrediction {
  secondsAhead: number;
  vramUsedMB: number;
  ramAvailableMB: number;
  confidence: number;  // decays with time
}

/** Action recommendation from the chain */
export interface ChainRecommendation {
  action: "prestage" | "evict" | "dormant" | "idle" | "monitor";
  reason: string;
  urgency: number;  // 0-1
}

/** Budget status */
export interface BudgetStatus {
  userCeiling: number;
  hostShare: number;
  colonyShare: number;
  gpuBudgetMB: number;
  ramBudgetMB: number;
  dormant: boolean;
  dormancyReason: string;
}

// ── Chain Engine ─────────────────────────────────────────────────────────

export class DerivativeChainEngine {
  private sampler: PlatformSampler;
  private history: ChainSnapshot[] = [];
  private maxHistory: number;
  private userCeiling: number;
  private sampleIntervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private onSample: ((snapshot: ChainSnapshot) => void) | null = null;

  constructor(options: {
    maxHistory?: number;
    userCeiling?: number;
    sampleIntervalMs?: number;
    onSample?: (snapshot: ChainSnapshot) => void;
  } = {}) {
    this.sampler = getSampler();
    this.maxHistory = options.maxHistory ?? 120;
    this.userCeiling = options.userCeiling ?? 0.5;
    this.sampleIntervalMs = options.sampleIntervalMs ?? 5000;
    this.onSample = options.onSample ?? null;
  }

  /** Start the sampling loop */
  start(): void {
    if (this.timer) return;
    // Sample immediately
    this.sample();
    // Then on interval
    this.timer = setInterval(() => this.sample(), this.sampleIntervalMs);
  }

  /** Stop the sampling loop */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Take one sample of all four tiers */
  sample(): ChainSnapshot {
    const gpu = this.sampler.getGPU();
    const ram = this.sampler.getRAM();
    const disk = this.sampler.getDisk();

    // Estimate RAM bandwidth from delta with previous sample
    let ramBandwidth = 0;
    if (this.history.length > 0) {
      const prev = this.history[this.history.length - 1];
      const dt = (Date.now() - prev.timestamp) / 1000;
      if (dt > 0) {
        ramBandwidth = Math.abs(ram.availableMB - prev.ramAvailableMB) / dt;
      }
    }

    const snapshot: ChainSnapshot = {
      timestamp: Date.now(),
      diskReadMBps: disk.readRateMBps,
      diskWriteMBps: disk.writeRateMBps,
      ramTotalMB: ram.totalMB,
      ramAvailableMB: ram.availableMB,
      ramUsedMB: ram.usedMB,
      ramBandwidthMBps: ramBandwidth,
      cpuCores: this.sampler.getCPU().cores,
      cpuThreads: this.sampler.getCPU().threads,
      vramAvailable: gpu.available,
      vramTotalMB: gpu.totalMB,
      vramUsedMB: gpu.usedMB,
      vramFreeMB: gpu.freeMB,
      vramUtilPct: gpu.utilPct,
    };

    this.history.push(snapshot);
    if (this.history.length > this.maxHistory) this.history.shift();

    if (this.onSample) this.onSample(snapshot);

    return snapshot;
  }

  /** Compute derivatives from recent history */
  getDerivatives(): ChainDerivatives {
    const n = this.history.length;
    if (n < 2) {
      return { ramVelocityMBps: 0, vramVelocityMBps: 0, ramAccelMBps2: 0, vramAccelMBps2: 0 };
    }

    const curr = this.history[n - 1];
    const prev = this.history[n - 2];
    const dt = (curr.timestamp - prev.timestamp) / 1000;

    // First derivatives
    const ramVel = dt > 0 ? (curr.ramUsedMB - prev.ramUsedMB) / dt : 0;
    const vramVel = dt > 0 ? (curr.vramUsedMB - prev.vramUsedMB) / dt : 0;

    // Second derivatives (need 3 points)
    let ramAccel = 0;
    let vramAccel = 0;
    if (n >= 3) {
      const prevprev = this.history[n - 3];
      const dt1 = (prev.timestamp - prevprev.timestamp) / 1000;
      if (dt1 > 0 && dt > 0) {
        const prevRamVel = (prev.ramUsedMB - prevprev.ramUsedMB) / dt1;
        const prevVramVel = (prev.vramUsedMB - prevprev.vramUsedMB) / dt1;
        const avgDt = (dt + dt1) / 2;
        ramAccel = (ramVel - prevRamVel) / avgDt;
        vramAccel = (vramVel - prevVramVel) / avgDt;
      }
    }

    return {
      ramVelocityMBps: ramVel,
      vramVelocityMBps: vramVel,
      ramAccelMBps2: ramAccel,
      vramAccelMBps2: vramAccel,
    };
  }

  /** Predict future state using x(t) = x₀ + v·t + ½a·t² */
  predict(secondsAhead: number): ChainPrediction {
    const n = this.history.length;
    if (n === 0) {
      return { secondsAhead, vramUsedMB: 0, ramAvailableMB: 0, confidence: 0 };
    }

    const curr = this.history[n - 1];
    const d = this.getDerivatives();

    const vramPred = curr.vramUsedMB
      + d.vramVelocityMBps * secondsAhead
      + 0.5 * d.vramAccelMBps2 * secondsAhead * secondsAhead;

    const ramPred = curr.ramAvailableMB
      - d.ramVelocityMBps * secondsAhead
      - 0.5 * d.ramAccelMBps2 * secondsAhead * secondsAhead;

    // Confidence decays with prediction horizon and increases with history
    const historyFactor = Math.min(1, n / 20);
    const timeFactor = Math.exp(-secondsAhead / 60);
    const confidence = historyFactor * timeFactor;

    return {
      secondsAhead,
      vramUsedMB: Math.max(0, Math.min(curr.vramTotalMB, vramPred)),
      ramAvailableMB: Math.max(0, Math.min(curr.ramTotalMB, ramPred)),
      confidence,
    };
  }

  /** Get action recommendation based on current chain state */
  recommend(): ChainRecommendation {
    const n = this.history.length;
    if (n === 0) return { action: "monitor", reason: "no data yet", urgency: 0 };

    const curr = this.history[n - 1];
    const budget = this.getBudget();

    // Dormancy check — never be parasitic
    if (budget.dormant) {
      return { action: "dormant", reason: budget.dormancyReason, urgency: 1 };
    }

    // VRAM prediction
    if (curr.vramAvailable) {
      const pred30 = this.predict(30);

      // VRAM about to fill — evict something
      if (pred30.vramUsedMB > curr.vramTotalMB * 0.9 && pred30.confidence > 0.3) {
        return {
          action: "evict",
          reason: `VRAM predicted ${pred30.vramUsedMB.toFixed(0)}MB in 30s (${(pred30.vramUsedMB/curr.vramTotalMB*100).toFixed(0)}%)`,
          urgency: 0.8,
        };
      }

      // VRAM has room and observer is active — good time to prestage
      if (curr.vramUtilPct > 30 && curr.ramAvailableMB > 4000 && curr.vramFreeMB > 2000) {
        return {
          action: "prestage",
          reason: "observer active, void available, headroom exists",
          urgency: 0.3,
        };
      }
    }

    // Theory-driven pressure check: if θ is in tunneling zone (approaching φ),
    // start evicting proactively before we hit IBH dormancy
    const derivatives = this.getDerivatives();
    const q = computeHardwareQuaternion(curr, derivatives);
    const phase = getThetaPhase(q.norm);

    if (phase.phase === "tunneling") {
      return {
        action: "evict",
        reason: `θ=${phase.theta.toFixed(3)} TUNNELING — approaching IBH at φ, reducing footprint`,
        urgency: 0.6,
      };
    }

    return { action: "idle", reason: "system healthy", urgency: 0 };
  }

  /** Calculate resource budget using φ rule and θ phase dormancy */
  getBudget(): BudgetStatus {
    const n = this.history.length;
    const curr = n > 0 ? this.history[n - 1] : null;

    let dormant = false;
    let dormancyReason = "ok";
    let gpuBudgetMB = 0;
    let ramBudgetMB = 0;

    if (curr) {
      // GPU budget
      if (curr.vramAvailable) {
        const goldenGPU = curr.vramTotalMB * COLONY_SHARE;
        const ceilingGPU = curr.vramTotalMB * this.userCeiling;
        const availableGPU = curr.vramFreeMB * 0.8;
        gpuBudgetMB = Math.min(goldenGPU, ceilingGPU, availableGPU);
      }

      // RAM budget
      const goldenRAM = curr.ramTotalMB * COLONY_SHARE;
      const ceilingRAM = curr.ramTotalMB * this.userCeiling;
      const availableRAM = curr.ramAvailableMB * 0.8;
      ramBudgetMB = Math.min(goldenRAM, ceilingRAM, availableRAM);

      // ── Theory-driven dormancy via |q| → θ phase ──
      // Instead of arbitrary thresholds (VRAM<500, RAM<2048),
      // compute the hardware quaternion and check if θ ≥ φ (IBH).
      // The theory says: at φ, information flows in but nothing useful
      // comes out. That's exactly when a colony should go dormant.
      const derivatives = this.getDerivatives();
      const q = computeHardwareQuaternion(curr, derivatives);
      const phase = getThetaPhase(q.norm);

      if (phase.shouldDormant) {
        dormant = true;
        dormancyReason = `θ=${phase.theta.toFixed(3)} → ${phase.phase.toUpperCase()} — ${phase.description}`;
      }
    }

    return {
      userCeiling: this.userCeiling,
      hostShare: HOST_SHARE,
      colonyShare: COLONY_SHARE,
      gpuBudgetMB,
      ramBudgetMB,
      dormant,
      dormancyReason,
    };
  }

  /** Set resource ceiling (0.1 to 0.9) */
  setCeiling(fraction: number): void {
    this.userCeiling = Math.max(0.1, Math.min(0.9, fraction));
  }

  /** Get the current snapshot */
  current(): ChainSnapshot | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  /** Get full status */
  status() {
    const curr = this.current();
    const deriv = this.getDerivatives();
    const budget = this.getBudget();
    const rec = this.recommend();
    const pred30 = this.predict(30);
    const pred60 = this.predict(60);

    return {
      running: this.timer !== null,
      platform: this.sampler.platform,
      historyLength: this.history.length,
      sampleIntervalMs: this.sampleIntervalMs,
      chain: curr ? {
        disk: { role: "field (x)", readMBps: curr.diskReadMBps, writeMBps: curr.diskWriteMBps },
        ram: {
          role: "velocity (dx/dt)",
          totalMB: curr.ramTotalMB,
          availableMB: curr.ramAvailableMB,
          usedMB: curr.ramUsedMB,
          bandwidthMBps: curr.ramBandwidthMBps,
          velocity: deriv.ramVelocityMBps,
          acceleration: deriv.ramAccelMBps2,
        },
        cpu: { role: "acceleration (d²x/dt²)", cores: curr.cpuCores, threads: curr.cpuThreads },
        vram: {
          role: "observer (collapse)",
          available: curr.vramAvailable,
          totalMB: curr.vramTotalMB,
          usedMB: curr.vramUsedMB,
          freeMB: curr.vramFreeMB,
          utilPct: curr.vramUtilPct,
          velocity: deriv.vramVelocityMBps,
          acceleration: deriv.vramAccelMBps2,
        },
      } : null,
      predictions: {
        vram30s: pred30.vramUsedMB,
        vram60s: pred60.vramUsedMB,
        ram30s: pred30.ramAvailableMB,
        ram60s: pred60.ramAvailableMB,
        confidence30s: pred30.confidence,
        confidence60s: pred60.confidence,
      },
      budget,
      recommendation: rec,
    };
  }
}
