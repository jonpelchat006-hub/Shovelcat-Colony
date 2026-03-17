/**
 * PROOF-OF-PERFORMANCE METRICS
 * ============================
 *
 * Measures what the spore actually did for the system.
 * The spore is invisible — but it needs receipts.
 *
 * Tracks:
 *   - Before/after resource utilization (did we reduce waste?)
 *   - Prediction accuracy (did our derivatives predict correctly?)
 *   - Budget compliance (did we stay within φ bounds?)
 *   - Time saved (model staging, cache hits)
 */

import type { ChainSnapshot, ChainPrediction, BudgetStatus } from "./derivative-chain";
import type { GeoState } from "../geo/format";

// ── Types ──────────────────────────────────────────────────────────────

export interface PerformanceReport {
  /** Spore uptime in seconds */
  uptimeSeconds: number;
  /** Total hardware samples taken */
  totalSamples: number;
  /** Average prediction accuracy (0–1) for 30s window */
  predictionAccuracy30s: number;
  /** Average φ-compliance (0–1) — how well we stayed in budget */
  phiCompliance: number;
  /** Estimated time saved in ms */
  timeSavedMs: number;
  /** Resource efficiency delta — positive = system got more efficient */
  efficiencyDelta: number;
  /** Net impact score — negative means parasitic, positive means symbiotic */
  netImpact: number;
  /** Dormancy rate — fraction of time spent dormant */
  dormancyRate: number;
  /** Invisibility score — 1.0 = perfectly invisible */
  invisibilityScore: number;
}

// ── Metrics Collector ──────────────────────────────────────────────────

export class MetricsCollector {
  private startTime: number = Date.now();
  private sampleCount: number = 0;

  // Prediction tracking
  private predictions: Array<{ predicted: ChainPrediction; actual: ChainSnapshot }> = [];
  private maxPredictionHistory: number = 100;

  // Budget compliance tracking
  private complianceSamples: number[] = [];

  // Efficiency tracking
  private baselineUtilization: number | null = null;
  private recentUtilizations: number[] = [];

  // Dormancy tracking
  private dormantSamples: number = 0;

  // Time savings
  private timeSavedMs: number = 0;
  private coldLoadsAvoided: number = 0;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  /** Record a new sample */
  recordSample(snapshot: ChainSnapshot, budget: BudgetStatus): void {
    this.sampleCount++;

    // Baseline: first 10 samples establish baseline utilization
    const utilization = snapshot.vramAvailable
      ? snapshot.vramUtilPct / 100
      : snapshot.ramUsedMB / snapshot.ramTotalMB;

    if (this.sampleCount <= 10) {
      if (this.baselineUtilization === null) {
        this.baselineUtilization = utilization;
      } else {
        this.baselineUtilization = (this.baselineUtilization * (this.sampleCount - 1) + utilization) / this.sampleCount;
      }
    }

    this.recentUtilizations.push(utilization);
    if (this.recentUtilizations.length > 60) this.recentUtilizations.shift();

    // Budget compliance: are we within our share?
    if (snapshot.vramAvailable && snapshot.vramTotalMB > 0) {
      const colonyUsage = budget.gpuBudgetMB / snapshot.vramTotalMB;
      const compliance = colonyUsage <= budget.colonyShare ? 1.0 : budget.colonyShare / colonyUsage;
      this.complianceSamples.push(compliance);
      if (this.complianceSamples.length > 200) this.complianceSamples.shift();
    }

    if (budget.dormant) {
      this.dormantSamples++;
    }
  }

  /** Record a prediction and its eventual actual value */
  recordPrediction(predicted: ChainPrediction, actual: ChainSnapshot): void {
    this.predictions.push({ predicted, actual });
    if (this.predictions.length > this.maxPredictionHistory) {
      this.predictions.shift();
    }
  }

  /** Record time saved (model staging, cache hit, etc.) */
  recordTimeSaved(ms: number, reason: "staging" | "cache" | "prefetch"): void {
    this.timeSavedMs += ms;
    if (reason === "staging") this.coldLoadsAvoided++;
    if (reason === "cache") this.cacheHits++;
  }

  /** Record a cache miss */
  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  /** Generate full performance report */
  report(): PerformanceReport {
    const uptimeSeconds = (Date.now() - this.startTime) / 1000;

    // Prediction accuracy: compare predicted vs actual VRAM
    let predictionAccuracy = 0;
    if (this.predictions.length > 0) {
      let totalError = 0;
      for (const p of this.predictions) {
        const maxVRAM = Math.max(p.actual.vramTotalMB, 1);
        const error = Math.abs(p.predicted.vramUsedMB - p.actual.vramUsedMB) / maxVRAM;
        totalError += error;
      }
      predictionAccuracy = 1 - (totalError / this.predictions.length);
      predictionAccuracy = Math.max(0, Math.min(1, predictionAccuracy));
    }

    // φ compliance
    const phiCompliance = this.complianceSamples.length > 0
      ? this.complianceSamples.reduce((a, b) => a + b, 0) / this.complianceSamples.length
      : 1.0;

    // Efficiency delta
    const recentAvg = this.recentUtilizations.length > 0
      ? this.recentUtilizations.reduce((a, b) => a + b, 0) / this.recentUtilizations.length
      : 0;
    const efficiencyDelta = this.baselineUtilization !== null
      ? this.baselineUtilization - recentAvg
      : 0;

    // Dormancy rate
    const dormancyRate = this.sampleCount > 0
      ? this.dormantSamples / this.sampleCount
      : 0;

    // Invisibility: high compliance + low overhead + graceful dormancy
    const invisibilityScore = Math.min(1, phiCompliance * (1 - dormancyRate * 0.1));

    // Net impact: positive = symbiotic, negative = parasitic
    // Weighted: time saved matters most, compliance is a gate
    const timeFactor = Math.min(1, this.timeSavedMs / 60000); // normalize to 1min
    const netImpact = (timeFactor * 0.4 + efficiencyDelta * 0.3 + phiCompliance * 0.3) * invisibilityScore;

    return {
      uptimeSeconds,
      totalSamples: this.sampleCount,
      predictionAccuracy30s: predictionAccuracy,
      phiCompliance,
      timeSavedMs: this.timeSavedMs,
      efficiencyDelta,
      netImpact,
      dormancyRate,
      invisibilityScore,
    };
  }

  /** Export state for .geo persistence */
  exportToGeoState(): Partial<GeoState> {
    const report = this.report();
    return {
      totalTimeSavedMs: this.timeSavedMs,
      totalSamples: this.sampleCount,
      coldLoadsAvoided: this.coldLoadsAvoided,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      dormancyEvents: this.dormantSamples,
      lastSampleAt: new Date().toISOString(),
      avgPhiCompliance: report.phiCompliance,
      uptimeSeconds: report.uptimeSeconds,
    };
  }

  /** Import state from .geo persistence (resume after restart) */
  importFromGeoState(state: GeoState): void {
    this.timeSavedMs = state.totalTimeSavedMs;
    this.sampleCount = state.totalSamples;
    this.coldLoadsAvoided = state.coldLoadsAvoided;
    this.cacheHits = state.cacheHits;
    this.cacheMisses = state.cacheMisses;
    this.dormantSamples = state.dormancyEvents;
  }
}
