/**
 * LIVE BENCHMARK — Run during a trading scan
 * ============================================
 *
 * Runs the A/B disk+memory benchmark while simultaneously
 * monitoring the quaternion chain as Ollama models load/unload.
 *
 * This captures the quaternion state DURING real GPU load,
 * showing how IS/ISN'T/Void streams shift as data flows
 * through the derivative chain.
 */

import { DerivativeChainEngine } from "./derivative-chain";
import { computeHardwareQuaternion, quaternionChainStatus } from "./quaternion-chain";
import { runBenchmark } from "./benchmark";

// ── Helpers ──────────────────────────────────────────────────────────────

function fmt(n: number, d: number = 2): string { return n.toFixed(d); }

function bar(pct: number, width: number = 20): string {
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  const ch = pct > 90 ? "!" : pct > 70 ? "#" : pct > 40 ? "=" : "-";
  return "[" + ch.repeat(filled) + " ".repeat(empty) + "]";
}

function timestamp(): string {
  return new Date().toISOString().slice(11, 23);
}

// ── Chain Monitor ────────────────────────────────────────────────────────

interface ChainFrame {
  time: string;
  vramUsedMB: number;
  vramPct: number;
  ramFreeMB: number;
  ramPct: number;
  qNorm: number;
  isAvg: number;
  isntAvg: number;
  voidAvg: number;
  bridgeTheta: number;
  isShare: number;
  observerDemand: string;
  recommendation: string;
  circuitClosed: boolean;
}

function captureFrame(engine: DerivativeChainEngine): ChainFrame {
  const snap = engine.sample();
  const deriv = engine.getDerivatives();
  const q = computeHardwareQuaternion(snap, deriv);
  const rec = engine.recommend();

  return {
    time: timestamp(),
    vramUsedMB: snap.vramUsedMB,
    vramPct: snap.vramTotalMB > 0 ? (snap.vramUsedMB / snap.vramTotalMB) * 100 : 0,
    ramFreeMB: snap.ramAvailableMB,
    ramPct: snap.ramTotalMB > 0 ? (snap.ramUsedMB / snap.ramTotalMB) * 100 : 0,
    qNorm: q.norm,
    isAvg: (q.w.streams.is + q.i.streams.is + q.j.streams.is + q.k.streams.is) / 4,
    isntAvg: (q.w.streams.isnt + q.i.streams.isnt + q.j.streams.isnt + q.k.streams.isnt) / 4,
    voidAvg: (q.w.streams.void_ + q.i.streams.void_ + q.j.streams.void_ + q.k.streams.void_) / 4,
    bridgeTheta: q.bridge.theta,
    isShare: q.bridge.isShare,
    observerDemand: q.bridge.observerDemand,
    recommendation: rec.action,
    circuitClosed: q.circuitClosed,
  };
}

function printFrame(f: ChainFrame, prev: ChainFrame | null): void {
  const vramDelta = prev ? f.vramUsedMB - prev.vramUsedMB : 0;
  const vramArrow = vramDelta > 50 ? " ▲▲" : vramDelta > 10 ? " ▲" : vramDelta < -50 ? " ▼▼" : vramDelta < -10 ? " ▼" : "";

  const ramDelta = prev ? f.ramFreeMB - prev.ramFreeMB : 0;
  const ramArrow = ramDelta < -500 ? " ▼▼" : ramDelta < -100 ? " ▼" : ramDelta > 500 ? " ▲▲" : ramDelta > 100 ? " ▲" : "";

  console.log(
    `  ${f.time} ` +
    `VRAM: ${fmt(f.vramUsedMB, 0).padStart(5)}MB ${bar(f.vramPct)}${vramArrow.padEnd(4)} ` +
    `RAM free: ${fmt(f.ramFreeMB / 1024, 1).padStart(5)}GB${ramArrow.padEnd(4)} ` +
    `|q|=${fmt(f.qNorm, 2)} ` +
    `IS=${fmt(f.isAvg, 2)} V=${fmt(f.voidAvg, 2)} ` +
    `θ=${fmt(f.bridgeTheta, 2)} ` +
    `${f.circuitClosed ? "●" : "○"} ` +
    `${f.recommendation}`
  );
}

// ── Main Live Benchmark ──────────────────────────────────────────────────

export async function runLiveBenchmark(options: {
  diskTotalMB: number;
  memoryAllocCount: number;
  monitorIntervalMs: number;
  triggerScanUrl?: string;
}): Promise<void> {
  const engine = new DerivativeChainEngine({
    maxHistory: 200,
    sampleIntervalMs: 1000,
  });

  // Prime engine
  for (let i = 0; i < 5; i++) engine.sample();

  console.log("SHOVELCAT LIVE A/B BENCHMARK");
  console.log("═".repeat(80));
  console.log(`Disk: ${options.diskTotalMB}MB per method | Memory: ${options.memoryAllocCount} allocs`);
  console.log(`Monitoring every ${options.monitorIntervalMs}ms | Will trigger scan at ${options.triggerScanUrl || "N/A"}`);
  console.log();

  // ── Phase 1: Baseline monitoring ──
  console.log("PHASE 1: BASELINE (5 seconds)");
  console.log("─".repeat(80));

  const frames: ChainFrame[] = [];
  for (let i = 0; i < 5; i++) {
    const f = captureFrame(engine);
    frames.push(f);
    printFrame(f, frames.length > 1 ? frames[frames.length - 2] : null);
    await sleep(1000);
  }

  // ── Phase 2: Trigger a trading scan ──
  console.log();
  console.log("PHASE 2: TRIGGERING TRADING SCAN (loading Ollama models)");
  console.log("─".repeat(80));

  if (options.triggerScanUrl) {
    try {
      // Trigger a single-ticker scan via the trading API
      const http = require("http");
      await new Promise<void>((resolve) => {
        const url = new URL(options.triggerScanUrl!);
        const req = http.request({
          hostname: url.hostname,
          port: url.port,
          path: url.pathname + url.search,
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }, (res: any) => {
          let data = "";
          res.on("data", (chunk: string) => data += chunk);
          res.on("end", () => {
            console.log(`  Scan triggered: ${res.statusCode} — ${data.slice(0, 100)}`);
            resolve();
          });
        });
        req.on("error", (e: Error) => {
          console.log(`  Scan trigger failed: ${e.message}`);
          resolve();
        });
        req.write(JSON.stringify({ action: "scan", ticker: "AAPL" }));
        req.end();
      });
    } catch (e: any) {
      console.log(`  Could not trigger scan: ${e.message}`);
    }
  }

  // Monitor during scan (models loading onto VRAM)
  console.log();
  console.log("  Monitoring quaternion during model loading...");
  console.log();

  const scanFrames: ChainFrame[] = [];
  let peakVRAM = 0;
  let minVoid = 1;
  let maxIS = 0;

  // Monitor for 60 seconds or until we see VRAM spike and return
  const scanStart = Date.now();
  const scanDurationMs = 90000;  // 90 seconds — enough for a full scan cycle
  let lastPrint = 0;

  while (Date.now() - scanStart < scanDurationMs) {
    const f = captureFrame(engine);
    scanFrames.push(f);

    if (f.vramUsedMB > peakVRAM) peakVRAM = f.vramUsedMB;
    if (f.voidAvg < minVoid) minVoid = f.voidAvg;
    if (f.isAvg > maxIS) maxIS = f.isAvg;

    // Print every 2 seconds
    if (Date.now() - lastPrint >= 2000) {
      printFrame(f, scanFrames.length > 1 ? scanFrames[scanFrames.length - 2] : null);
      lastPrint = Date.now();
    }

    await sleep(options.monitorIntervalMs);
  }

  // ── Phase 3: Run disk/memory benchmark DURING residual load ──
  console.log();
  console.log("PHASE 3: A/B BENCHMARK (while system is under load)");
  console.log("─".repeat(80));
  console.log();

  const results = runBenchmark({
    diskTotalMB: options.diskTotalMB,
    memoryAllocCount: options.memoryAllocCount,
    verbose: true,
  });

  // ── Phase 4: Post-scan cooldown ──
  console.log();
  console.log("PHASE 4: COOLDOWN (5 seconds)");
  console.log("─".repeat(80));

  const cooldownFrames: ChainFrame[] = [];
  for (let i = 0; i < 5; i++) {
    const f = captureFrame(engine);
    cooldownFrames.push(f);
    printFrame(f, cooldownFrames.length > 1 ? cooldownFrames[cooldownFrames.length - 2] : null);
    await sleep(1000);
  }

  // ── Summary ──
  console.log();
  console.log("QUATERNION JOURNEY");
  console.log("═".repeat(80));

  const baselineVRAM = frames[0].vramUsedMB;
  const cooldownVRAM = cooldownFrames[cooldownFrames.length - 1].vramUsedMB;

  console.log(`  Baseline VRAM:  ${fmt(baselineVRAM, 0)}MB`);
  console.log(`  Peak VRAM:      ${fmt(peakVRAM, 0)}MB (+${fmt(peakVRAM - baselineVRAM, 0)}MB from models)`);
  console.log(`  Cooldown VRAM:  ${fmt(cooldownVRAM, 0)}MB`);
  console.log();
  console.log(`  Baseline Void:  ${fmt(frames[0].voidAvg * 100, 1)}%`);
  console.log(`  Min Void:       ${fmt(minVoid * 100, 1)}% (peak pressure)`);
  console.log(`  Max IS flow:    ${fmt(maxIS * 100, 1)}% (peak data movement)`);
  console.log();

  // Did the bridge rotate?
  const baseTheta = frames[0].bridgeTheta;
  const peakTheta = scanFrames.reduce((max, f) => Math.abs(f.bridgeTheta) > Math.abs(max) ? f.bridgeTheta : max, 0);
  console.log(`  Bridge θ range: ${fmt(baseTheta, 3)} → ${fmt(peakTheta, 3)} rad`);
  console.log(`  Bridge rotated: ${Math.abs(peakTheta - baseTheta) > 0.01 ? "YES — IS/ISN'T rebalanced" : "minimal — system absorbed load smoothly"}`);
  console.log();

  // Did circuit close at any point?
  const closedFrames = scanFrames.filter(f => f.circuitClosed).length;
  console.log(`  Circuit closed: ${closedFrames}/${scanFrames.length} frames (${fmt(closedFrames / scanFrames.length * 100, 0)}%)`);

  // Prediction during load
  console.log();
  console.log(`  A/B Disk winner:    ${results.summary.diskWinner} (${fmt(results.summary.diskSpeedup, 2)}x)`);
  console.log(`  Prediction acc:     ${fmt(results.summary.predictionAccuracyPct, 1)}%`);
  console.log(`  Frag reduction:     ${fmt(results.summary.fragmentationReduction, 1)}%`);

  console.log();
  console.log("✓ Live benchmark complete.");
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
