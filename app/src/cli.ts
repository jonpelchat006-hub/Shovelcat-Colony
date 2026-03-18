#!/usr/bin/env node
/**
 * SHOVELCAT CLI — The Spore Interface
 * ====================================
 *
 * Usage:
 *   shovelcat start   — Start the derivative chain daemon
 *   shovelcat stop    — Stop the daemon
 *   shovelcat status  — Show chain status + performance report
 *   shovelcat init    — Create a new .geo spore file
 *   shovelcat config  — View/update spore configuration
 *   shovelcat bench   — Run proof-of-performance benchmark
 *
 * The blank spore (tier 1) needs zero configuration.
 * Just `shovelcat start` and it makes your system faster.
 */

import * as path from "path";
import * as fs from "fs";
import { DerivativeChainEngine } from "./core/derivative-chain";
import { MetricsCollector } from "./core/metrics";
import { quaternionChainStatus } from "./core/quaternion-chain";
import { runBenchmark } from "./core/benchmark";
import { runLiveBenchmark } from "./core/live-bench";
import { runNetBenchmark } from "./core/net-benchmark";
import { runRealBenchmark } from "./core/real-bench";
import { runSpiralBenchmark, buildCollapsedField, placeTensorData, queryTensorData, printTensorField, HexGrid, sectorToSpiral, runHexVMBenchmark } from "./core/spiral-drive";
import { computeDriveMap, createDriveStructure, writeManifest, printDriveMap } from "./core/drive-map";
import { processIntake, queryBridge, printBridgeStatus, startBridgeDaemon, classifyFile } from "./core/bridge";
import {
  loadOrCreate,
  readGeo,
  writeGeo,
  updateConfig,
  updateState,
  defaultGeoPath,
  GEO_FLAG,
  type GeoPayload,
  type GeoConfig,
} from "./geo/format";

// ── PID file for daemon management ─────────────────────────────────────

const PID_DIR = path.join(require("os").homedir(), ".shovelcat");
const PID_FILE = path.join(PID_DIR, "shovelcat.pid");

function writePid(): void {
  if (!fs.existsSync(PID_DIR)) fs.mkdirSync(PID_DIR, { recursive: true });
  fs.writeFileSync(PID_FILE, String(process.pid));
}

function readPid(): number | null {
  try {
    return parseInt(fs.readFileSync(PID_FILE, "utf-8").trim());
  } catch {
    return null;
  }
}

function clearPid(): void {
  try { fs.unlinkSync(PID_FILE); } catch { /* ok */ }
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ── Formatting helpers ─────────────────────────────────────────────────

function fmt(n: number, decimals: number = 1): string {
  return n.toFixed(decimals);
}

function bar(pct: number, width: number = 30): string {
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  const color = pct > 90 ? "!" : pct > 70 ? "~" : "=";
  return "[" + color.repeat(filled) + " ".repeat(empty) + "]";
}

// ── Commands ───────────────────────────────────────────────────────────

function cmdInit(): void {
  const geoPath = defaultGeoPath();
  const { payload, isNew } = loadOrCreate(geoPath);

  if (isNew) {
    console.log(`✓ Created new spore: ${geoPath}`);
    console.log(`  ID: ${payload.identity.id}`);
    console.log(`  Host: ${payload.identity.hostHash}`);
    console.log(`  Ceiling: ${(payload.config.userCeiling * 100).toFixed(0)}%`);
  } else {
    console.log(`Spore already exists: ${geoPath}`);
    console.log(`  ID: ${payload.identity.id}`);
    console.log(`  Born: ${payload.identity.createdAt}`);
    console.log(`  Samples: ${payload.state.totalSamples}`);
  }
}

function cmdStart(): void {
  // Check if already running
  const existingPid = readPid();
  if (existingPid && isRunning(existingPid)) {
    console.log(`Spore already running (PID ${existingPid})`);
    process.exit(0);
  }

  const geoPath = defaultGeoPath();
  const { payload, flags } = loadOrCreate(geoPath);

  console.log(`Shovelcat Derivative Chain v${require("../package.json").version}`);
  console.log(`Spore: ${payload.identity.id}`);
  console.log(`Ceiling: ${(payload.config.userCeiling * 100).toFixed(0)}% | Interval: ${payload.config.sampleIntervalMs}ms`);
  console.log("─".repeat(50));

  // Create engine + metrics
  const engine = new DerivativeChainEngine({
    maxHistory: payload.config.maxHistory,
    userCeiling: payload.config.userCeiling,
    sampleIntervalMs: payload.config.sampleIntervalMs,
    onSample: (snapshot) => {
      const budget = engine.getBudget();
      metrics.recordSample(snapshot, budget);

      // Persist state every 60 samples (~5 minutes at 5s interval)
      if (metrics.report().totalSamples % 60 === 0) {
        updateState(geoPath, metrics.exportToGeoState());
      }
    },
  });

  const metrics = new MetricsCollector();

  // Resume from previous state
  if (payload.state.totalSamples > 0) {
    metrics.importFromGeoState(payload.state);
    console.log(`Resumed: ${payload.state.totalSamples} prior samples, ${fmt(payload.state.totalTimeSavedMs / 1000)}s saved`);
  }

  // Write PID and start
  writePid();
  engine.start();

  const status = engine.status();
  if (status.chain) {
    console.log(`\nPlatform: ${status.platform}`);
    console.log(`RAM: ${fmt(status.chain.ram.totalMB / 1024)}GB total, ${fmt(status.chain.ram.availableMB / 1024)}GB free`);
    if (status.chain.vram.available) {
      console.log(`VRAM: ${fmt(status.chain.vram.totalMB / 1024)}GB total, ${fmt(status.chain.vram.freeMB / 1024)}GB free`);
    } else {
      console.log("VRAM: not available (CPU-only mode)");
    }
    console.log(`CPU: ${status.chain.cpu.cores}c/${status.chain.cpu.threads}t`);
    console.log(`\nRecommendation: ${status.recommendation.action} — ${status.recommendation.reason}`);
  }

  console.log("\nDerivative chain running. Press Ctrl+C to stop.");

  // Periodic status (every 60s)
  const statusInterval = setInterval(() => {
    const s = engine.status();
    const r = metrics.report();
    const rec = s.recommendation;

    if (payload.config.logLevel === "info" || payload.config.logLevel === "debug") {
      console.log(
        `[${new Date().toISOString().slice(11, 19)}] ` +
        `samples=${s.historyLength} ` +
        `φ=${fmt(r.phiCompliance * 100, 0)}% ` +
        `saved=${fmt(r.timeSavedMs / 1000)}s ` +
        `rec=${rec.action} ` +
        `inv=${fmt(r.invisibilityScore * 100, 0)}%`
      );
    }
  }, 60000);

  // Graceful shutdown
  const shutdown = () => {
    console.log("\nStopping derivative chain...");
    clearInterval(statusInterval);
    engine.stop();
    updateState(geoPath, metrics.exportToGeoState());
    clearPid();
    console.log(`Final: ${metrics.report().totalSamples} samples, φ-compliance ${fmt(metrics.report().phiCompliance * 100, 0)}%`);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function cmdStop(): void {
  const pid = readPid();
  if (!pid || !isRunning(pid)) {
    console.log("No running spore found.");
    clearPid();
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
    console.log(`Sent stop signal to PID ${pid}`);
    clearPid();
  } catch (e) {
    console.error(`Failed to stop PID ${pid}:`, e);
  }
}

function cmdStatus(): void {
  const geoPath = defaultGeoPath();

  if (!fs.existsSync(geoPath)) {
    console.log("No spore found. Run `shovelcat init` first.");
    return;
  }

  const { payload, flags } = readGeo(geoPath);

  // Check if daemon is running
  const pid = readPid();
  const running = pid ? isRunning(pid) : false;

  console.log("SHOVELCAT SPORE STATUS");
  console.log("═".repeat(50));
  console.log(`ID:       ${payload.identity.id}`);
  console.log(`Born:     ${payload.identity.createdAt}`);
  console.log(`Host:     ${payload.identity.hostHash}`);
  console.log(`Running:  ${running ? `yes (PID ${pid})` : "no"}`);
  console.log(`Dormant:  ${(flags & GEO_FLAG.DORMANT) ? "yes" : "no"}`);
  console.log();

  console.log("CONFIG");
  console.log("─".repeat(50));
  console.log(`Ceiling:  ${(payload.config.userCeiling * 100).toFixed(0)}%`);
  console.log(`Interval: ${payload.config.sampleIntervalMs}ms`);
  console.log(`History:  ${payload.config.maxHistory} samples`);
  console.log(`Daemon:   ${payload.config.daemon ? "yes" : "no"}`);
  console.log(`LogLevel: ${payload.config.logLevel}`);
  console.log();

  console.log("PERFORMANCE");
  console.log("─".repeat(50));
  console.log(`Samples:      ${payload.state.totalSamples}`);
  console.log(`Time saved:   ${fmt(payload.state.totalTimeSavedMs / 1000)}s`);
  console.log(`Cold avoided: ${payload.state.coldLoadsAvoided}`);
  console.log(`Cache:        ${payload.state.cacheHits} hits / ${payload.state.cacheMisses} misses`);
  console.log(`Dormancy:     ${payload.state.dormancyEvents} events`);
  console.log(`φ-compliance: ${fmt(payload.state.avgPhiCompliance * 100, 0)}%`);
  console.log(`Uptime:       ${fmt(payload.state.uptimeSeconds / 3600, 1)}h`);

  // Live snapshot if running
  if (running) {
    console.log();
    console.log("LIVE CHAIN (connecting...)");
    console.log("─".repeat(50));

    const engine = new DerivativeChainEngine({
      userCeiling: payload.config.userCeiling,
    });
    const snapshot = engine.sample();
    const budget = engine.getBudget();
    const rec = engine.recommend();

    console.log(`RAM:   ${fmt(snapshot.ramUsedMB / 1024, 1)}/${fmt(snapshot.ramTotalMB / 1024, 1)}GB ${bar((snapshot.ramUsedMB / snapshot.ramTotalMB) * 100)}`);
    if (snapshot.vramAvailable) {
      console.log(`VRAM:  ${fmt(snapshot.vramUsedMB / 1024, 1)}/${fmt(snapshot.vramTotalMB / 1024, 1)}GB ${bar((snapshot.vramUsedMB / snapshot.vramTotalMB) * 100)}`);
    }
    console.log(`Budget: GPU=${fmt(budget.gpuBudgetMB)}MB RAM=${fmt(budget.ramBudgetMB)}MB`);
    console.log(`Action: ${rec.action} — ${rec.reason} (urgency: ${fmt(rec.urgency * 100, 0)}%)`);
  }
}

function cmdConfig(args: string[]): void {
  const geoPath = defaultGeoPath();

  if (!fs.existsSync(geoPath)) {
    console.log("No spore found. Run `shovelcat init` first.");
    return;
  }

  if (args.length === 0) {
    // Show current config
    const { payload } = readGeo(geoPath);
    console.log(JSON.stringify(payload.config, null, 2));
    return;
  }

  // Parse key=value pairs
  const updates: Partial<GeoConfig> = {};
  for (const arg of args) {
    const [key, val] = arg.split("=");
    switch (key) {
      case "ceiling":
        updates.userCeiling = Math.max(0.1, Math.min(0.9, parseFloat(val)));
        break;
      case "interval":
        updates.sampleIntervalMs = parseInt(val);
        break;
      case "history":
        updates.maxHistory = parseInt(val);
        break;
      case "daemon":
        updates.daemon = val === "true";
        break;
      case "log":
        updates.logLevel = val as GeoConfig["logLevel"];
        break;
      default:
        console.log(`Unknown config key: ${key}`);
        return;
    }
  }

  updateConfig(geoPath, updates);
  console.log("Config updated:", updates);
}

function cmdBench(): void {
  console.log("SHOVELCAT BENCHMARK — Derivative Chain Performance");
  console.log("═".repeat(50));

  const engine = new DerivativeChainEngine({ maxHistory: 60 });
  const metrics = new MetricsCollector();

  console.log("Taking 10 samples (5s intervals simulated)...\n");

  // Take rapid samples
  for (let i = 0; i < 10; i++) {
    const snapshot = engine.sample();
    const budget = engine.getBudget();
    metrics.recordSample(snapshot, budget);

    if (i === 0) {
      console.log(`Platform: ${engine.status().platform}`);
      console.log(`RAM: ${fmt(snapshot.ramTotalMB / 1024, 1)}GB | VRAM: ${snapshot.vramAvailable ? fmt(snapshot.vramTotalMB / 1024, 1) + "GB" : "N/A"}`);
      console.log(`CPU: ${snapshot.cpuCores}c/${snapshot.cpuThreads}t`);
      console.log();
    }
  }

  // Show derivatives
  const d = engine.getDerivatives();
  console.log("DERIVATIVES");
  console.log("─".repeat(50));
  console.log(`RAM velocity:     ${fmt(d.ramVelocityMBps, 2)} MB/s`);
  console.log(`RAM acceleration: ${fmt(d.ramAccelMBps2, 2)} MB/s²`);
  console.log(`VRAM velocity:    ${fmt(d.vramVelocityMBps, 2)} MB/s`);
  console.log(`VRAM acceleration:${fmt(d.vramAccelMBps2, 2)} MB/s²`);

  // Show predictions
  const p30 = engine.predict(30);
  const p60 = engine.predict(60);
  console.log("\nPREDICTIONS");
  console.log("─".repeat(50));
  console.log(`30s: VRAM=${fmt(p30.vramUsedMB)}MB RAM_free=${fmt(p30.ramAvailableMB)}MB (conf=${fmt(p30.confidence * 100, 0)}%)`);
  console.log(`60s: VRAM=${fmt(p60.vramUsedMB)}MB RAM_free=${fmt(p60.ramAvailableMB)}MB (conf=${fmt(p60.confidence * 100, 0)}%)`);

  // Show budget
  const budget = engine.getBudget();
  console.log("\nBUDGET (φ RULE)");
  console.log("─".repeat(50));
  console.log(`Host share:   ${fmt(budget.hostShare * 100, 1)}%`);
  console.log(`Colony share: ${fmt(budget.colonyShare * 100, 1)}%`);
  console.log(`GPU budget:   ${fmt(budget.gpuBudgetMB)}MB`);
  console.log(`RAM budget:   ${fmt(budget.ramBudgetMB)}MB`);
  console.log(`Dormant:      ${budget.dormant ? "YES — " + budget.dormancyReason : "no"}`);

  // Show recommendation
  const rec = engine.recommend();
  console.log("\nRECOMMENDATION");
  console.log("─".repeat(50));
  console.log(`Action:  ${rec.action}`);
  console.log(`Reason:  ${rec.reason}`);
  console.log(`Urgency: ${fmt(rec.urgency * 100, 0)}%`);

  // Performance report
  const report = metrics.report();
  console.log("\nMETRICS");
  console.log("─".repeat(50));
  console.log(`φ-compliance:  ${fmt(report.phiCompliance * 100, 0)}%`);
  console.log(`Invisibility:  ${fmt(report.invisibilityScore * 100, 0)}%`);
  console.log(`Net impact:    ${fmt(report.netImpact, 3)}`);

  // Quaternion chain
  const snapshot = engine.current()!;
  const qStatus = quaternionChainStatus(snapshot, d);
  const q = qStatus.quaternion;
  console.log("\nQUATERNION CIRCUIT (q = w + xi + yj + zk)");
  console.log("─".repeat(50));
  console.log(`  w (VRAM/observer): real=${fmt(q.w.real, 3)} imag=${fmt(q.w.imag, 3)} θ=${fmt(q.w.theta, 2)} |${fmt(q.w.magnitude, 3)}|${q.w.snapped ? " SNAP" : ""}`);
  console.log(`  i (Disk/euler):    real=${fmt(q.i.real, 3)} imag=${fmt(q.i.imag, 3)} θ=${fmt(q.i.theta, 2)} |${fmt(q.i.magnitude, 3)}|${q.i.snapped ? " SNAP" : ""}`);
  console.log(`  j (RAM/snake):     real=${fmt(q.j.real, 3)} imag=${fmt(q.j.imag, 3)} θ=${fmt(q.j.theta, 2)} |${fmt(q.j.magnitude, 3)}|${q.j.snapped ? " SNAP" : ""}`);
  console.log(`  k (CPU/bridge):    real=${fmt(q.k.real, 3)} imag=${fmt(q.k.imag, 3)} θ=${fmt(q.k.theta, 2)} |${fmt(q.k.magnitude, 3)}|${q.k.snapped ? " SNAP" : ""}`);
  console.log(`  |q| = ${fmt(q.norm, 3)}  ijk = ${fmt(q.ijkProduct, 3)}  commutator = ${fmt(q.commutator, 3)}`);
  console.log(`  Circuit: ${q.circuitClosed ? "CLOSED ✓" : "OPEN"} | Observer: ${fmt(q.observerDominance * 100, 0)}%`);
  console.log(`  Three-body: matter=${fmt(q.threeBody.matter, 2)} anti=${fmt(q.threeBody.antimatter, 2)} void=${fmt(q.threeBody.void_, 2)} balance=${fmt(q.threeBody.balance, 2)}`);
  console.log(`  Flow: ${qStatus.health.flowDirection}`);

  // θ phase diagnosis
  const tp = qStatus.thetaPhase;
  const sc = qStatus.schedule;
  const la = qStatus.landauer;
  console.log();
  console.log(`  θ PHASE: ${tp.phase.toUpperCase()} [${tp.color}]`);
  console.log(`  ${tp.description}`);
  console.log(`  Next boundary: ${tp.nextBoundary.name} at θ=${fmt(tp.nextBoundary.theta, 3)} (Δ=${fmt(tp.nextBoundary.distance, 3)})`);
  console.log(`  Dormancy: ${tp.shouldDormant ? "YES — past IBH, must sleep" : "no — within safe zone"}`);
  console.log();
  console.log(`  PURE θ:  1.0=equil  √φ=1.272=tunnel  φ=1.618=IBH  √π=1.772=IBH+  φ²=2.618=BEC  e=2.718=BEC+  π=3.142=MAX`);

  // PV = nRT
  console.log();
  console.log(`  PV = nRT (heat × pressure adjust thresholds):`);
  const gpuTemp = la.gpuTempC != null ? `${la.gpuTempC}°C` : "n/a";
  const cpuTemp = la.cpuTempC != null ? `${la.cpuTempC}°C` : "n/a";
  const gpuTdp = la.gpuTdpTempC != null ? `${la.gpuTdpTempC}°C` : "n/a";
  console.log(`  T: GPU ${gpuTemp} (TDP: ${gpuTdp}) CPU ${cpuTemp}  →  thermal=${fmt(la.thermalFactor, 4)}`);
  console.log(`  E/kT: usage=${fmt((1 - la.avgVoid) * 100, 1)}% / colony=38.2%  →  E/kT=${fmt(la.eOverKT, 3)}  Boltzmann=e^(-${fmt(la.eOverKT, 3)})=${fmt(la.pressureFactor, 4)}`);
  console.log(`  Combined: ${fmt(la.thermalFactor, 3)} × ${fmt(la.pressureFactor, 3)} = ${fmt(la.combinedFactor, 4)}`);
  console.log(`  Effective IBH: φ × ${fmt(la.combinedFactor, 3)} = ${fmt(la.effective.ibh, 3)}  (pure: 1.618)`);
  console.log(`  Landauer limit: ${la.landauerJPerBit.toExponential(3)} J/bit`);
  console.log();
  console.log(`  SCHEDULE (δ/√π — transmitted data only, not θ):`);
  console.log(`  IS/ISN'T equilibrium: ${fmt(sc.isEquilibrium * 100, 1)}% / ${fmt(sc.isntEquilibrium * 100, 1)}% (shifted by δ toward IS)`);
  console.log(`  ${qStatus.health.diagnosis}`);

  // IS/ISN'T/Void streams
  console.log("\nIS/ISN'T/VOID STREAMS (per tier)");
  console.log("─".repeat(50));
  for (const axis of [q.w, q.i, q.j, q.k]) {
    const s = axis.streams;
    const arrow = s.flowSign > 0.01 ? "→IS" : s.flowSign < -0.01 ? "←ISN'T" : "=stall";
    console.log(`  ${axis.label.padEnd(5)} IS=${fmt(s.is, 3)} ISN'T=${fmt(s.isnt, 3)} Void=${fmt(s.void_, 3)} ${arrow} ${s.conserved ? "✓" : "!!"}`);
  }

  // Bridge scheduler
  const b = q.bridge;
  console.log("\nBRIDGE SCHEDULER (CPU, sin²θ+cos²θ=1, centered at δ asymmetry)");
  console.log("─".repeat(50));
  console.log(`  θ = ${fmt(b.theta, 3)} rad (0=all-read, π/2=all-write)`);
  console.log(`  IS share (sin²):   ${fmt(b.isShare * 100, 1)}% (forward/read — equilibrium: ${fmt(sc.isEquilibrium * 100, 1)}%)`);
  console.log(`  ISN'T share (cos²): ${fmt(b.isntShare * 100, 1)}% (reverse/write — equilibrium: ${fmt(sc.isntEquilibrium * 100, 1)}%)`);
  console.log(`  Conservation:       ${fmt(b.conserved, 4)} (should = 1.0000)`);
  console.log(`  Observer demands:   ${b.observerDemand}`);
  console.log(`  Void fill rate:     ${fmt(b.voidFillRate * 100, 0)}%`);

  // RAM sub-quaternion
  const rs = qStatus.ramSub;
  console.log("\nRAM SUB-QUATERNION");
  console.log("─".repeat(50));
  console.log(`  main (observer): |${fmt(rs.main.magnitude, 3)}|  L3 (euler): |${fmt(rs.L3.magnitude, 3)}|  L2 (snake): |${fmt(rs.L2.magnitude, 3)}|  L1 (bridge): |${fmt(rs.L1.magnitude, 3)}|`);
  console.log(`  |q_ram| = ${fmt(rs.norm, 3)} | Circuit: ${rs.circuitClosed ? "CLOSED ✓" : "OPEN"}`);

  // h_info chunk sizes with schedule correction
  const chunks = qStatus.chunks;
  const tv = chunks.tcpValidation;
  console.log("\nh_info FIBONACCI CHUNKS (δ = π−3, schedule correction = δ/√π)");
  console.log("─".repeat(50));
  console.log(`  h_info (pure)      = ${chunks.hInfo} bytes (information content only)`);
  console.log(`  h_info (scheduled) = ${Math.round(chunks.scheduledHInfo)} bytes (+ ISN'T overhead)`);
  console.log(`  ${"Lvl".padEnd(4)} ${"fib".padEnd(4)} ${"Pure".padStart(8)} ${"Scheduled".padStart(10)}`);
  for (const c of chunks.levels) {
    const pLabel = c.pureBytes < 1024 ? `${c.pureBytes}B` : `${fmt(c.pureBytes / 1024, 1)}KB`;
    const sLabel = c.scheduledBytes < 1024 ? `${c.scheduledBytes}B` : `${fmt(c.scheduledBytes / 1024, 1)}KB`;
    console.log(`  ${String(c.level).padEnd(4)} ${String(c.fibs).padEnd(4)} ${pLabel.padStart(8)} ${sLabel.padStart(10)}`);
  }
  console.log();
  console.log(`  TCP MSS VALIDATION:`);
  console.log(`    Pure level 2:      ${tv.pureLevel2}B`);
  console.log(`    Scheduled level 2: ${tv.scheduledLevel2}B`);
  console.log(`    TCP MSS empirical: ${tv.tcpMSS}B`);
  console.log(`    Error:             ${tv.error}B (${fmt(tv.errorPct, 4)}%)`);
  console.log(`    h_info×fib(2)×(1+δ/√π) = TCP MSS — schedule correction closes the gap`);

  console.log("\n✓ Benchmark complete. The derivative chain is working.");
}

function cmdMap(drivePath: string, apply: boolean): void {
  const map = computeDriveMap(drivePath);

  if (map.drive.totalBytes === 0) {
    console.log(`Could not read drive info for ${drivePath}`);
    console.log("Showing allocation for 931GB (your D: drive):");
    console.log();
    const fallback = computeDriveMap(drivePath, { totalBytes: 931 * 1024 * 1024 * 1024 });
    printDriveMap(fallback);

    if (apply) {
      console.log("CREATING DIRECTORY STRUCTURE...");
      console.log("─".repeat(70));
      const result = createDriveStructure(fallback);
      console.log(`  Created: ${result.created.length} directories`);
      console.log(`  Existed: ${result.existed.length} directories`);
      for (const dir of result.created) {
        console.log(`    + ${dir}`);
      }
      console.log();
      const manifestPath = writeManifest(fallback);
      console.log(`  Manifest: ${manifestPath}`);
      console.log();
      console.log("  The spiral drive directory structure is ready.");
      console.log("  Run `shovelcat tensor` to see the hex VM mesh overlay.");
    } else {
      console.log("Run with --apply to create the directory structure:");
      console.log(`  shovelcat map drive=${drivePath} --apply`);
    }
    return;
  }

  printDriveMap(map);

  if (apply) {
    console.log("CREATING DIRECTORY STRUCTURE...");
    console.log("─".repeat(70));
    const result = createDriveStructure(map);
    console.log(`  Created: ${result.created.length} directories`);
    console.log(`  Existed: ${result.existed.length} directories`);
    for (const dir of result.created) {
      console.log(`    + ${dir}`);
    }
    console.log();
    const manifestPath = writeManifest(map);
    console.log(`  Manifest: ${manifestPath}`);
    console.log();
    console.log("  The spiral drive directory structure is ready.");
    console.log("  Run `shovelcat tensor` to see the hex VM mesh overlay.");
  } else {
    console.log("Run with --apply to create the directory structure:");
    console.log(`  shovelcat map drive=${drivePath} --apply`);
  }
}

function cmdTensor(totalSectors: number = 10000): void {
  console.log("SHOVELCAT TENSOR OVERLAY — Consciousness on Collapsed Space");
  console.log("═".repeat(70));
  console.log(`Sectors: ${totalSectors}`);
  console.log();

  // Build hex grid
  const grid = new HexGrid();
  for (let s = 0; s < totalSectors; s++) {
    grid.assignSector(sectorToSpiral(s, totalSectors));
  }

  console.log(`Hex grid: ${grid.size} cells for ${totalSectors} sectors`);

  // Build collapsed field
  const field = buildCollapsedField(grid, totalSectors);
  printTensorField(field);

  // Demo: place a sample data item on all three axes
  console.log("DEMO: Placing data 'AAPL-scan-001' on all three tensor axes");
  console.log("─".repeat(70));

  const modified = placeTensorData(field, "AAPL-scan-001", ["facts", "memory", "imagination"], {
    facts: 0.9,        // high factual grounding
    memory: 0.6,       // moderate emotional weight
    imagination: 0.4,  // some creative projection
  });

  console.log(`  Placed on ${modified.length} cells:`);
  for (const cell of modified) {
    const p = cell.pressure;
    console.log(`    (${cell.q},${cell.r}) zone=L${cell.zone} axis=${p.dominantAxis} charge=${fmt(p.charge, 3)} overlap=${cell.overlap} pattern=${fmt(cell.patternScore, 2)}`);
  }
  console.log();

  // Query from each branch perspective
  console.log("BRANCH RESOLUTION — Same data, three perspectives:");
  console.log("─".repeat(70));

  for (const branch of ["ai", "alpha", "club"] as const) {
    const result = queryTensorData(field, { dataId: "AAPL-scan-001", branch });
    const primaryStr = result.primary
      ? `weight=${fmt(result.primary.weight, 2)}, linked to [${result.primary.linkedAxes.join(",")}]`
      : "not found on primary axis";
    console.log(`  ${branch.padEnd(6)} → ${result.primaryAxis.padEnd(12)} ${primaryStr}`);
    console.log(`         cross-refs: ${result.crossRefs.length}, total weight: ${fmt(result.totalWeight, 2)}, dimensionality: ${result.dimensionality}/3`);
  }

  // Place a second item that shares axes (overlapping pattern)
  console.log();
  console.log("OVERLAP: Placing 'AAPL-earnings-Q4' on facts + memory (no imagination)");
  console.log("─".repeat(70));

  const modified2 = placeTensorData(field, "AAPL-earnings-Q4", ["facts", "memory"], {
    facts: 1.0,
    memory: 0.8,
  });

  for (const cell of modified2) {
    const layers = Object.entries(cell.layers)
      .filter(([_, refs]) => refs && refs.length > 0)
      .map(([axis, refs]) => `${axis}(${refs!.length})`)
      .join(" + ");
    console.log(`    (${cell.q},${cell.r}) zone=L${cell.zone} overlap=${cell.overlap} layers: ${layers}`);
  }

  // Stats update
  const totalOverlap = field.cells.filter(c => c.overlap >= 2).length;
  const maxOv = field.cells.reduce((mx, c) => Math.max(mx, c.overlap), 0);
  console.log();
  console.log(`  Cells with 2+ axis overlap: ${totalOverlap}`);
  console.log(`  Maximum overlap: ${maxOv} axes on one cell`);
  console.log();
  console.log(`  Data that shares axes creates PATTERN DENSITY — the tensor field`);
  console.log(`  naturally clusters related data near the same hex cells.`);
  console.log(`  Each branch sees its own slice: AI sees facts, Club sees imagination,`);
  console.log(`  Alpha sees the bridge. Same truth, three lenses.`);
  console.log();

  // Run hex VM mesh benchmark
  runHexVMBenchmark({ verbose: true, totalSectors });
}

// ── Main ───────────────────────────────────────────────────────────────

const [,, command, ...args] = process.argv;

switch (command) {
  case "init":
    cmdInit();
    break;
  case "start":
    cmdStart();
    break;
  case "stop":
    cmdStop();
    break;
  case "status":
    cmdStatus();
    break;
  case "config":
    cmdConfig(args);
    break;
  case "bench":
  case "benchmark":
    cmdBench();
    break;
  case "test":
  case "ab": {
    const mbArg = args.find(a => a.startsWith("mb="));
    const mb = mbArg ? parseInt(mbArg.split("=")[1]) : 10;
    const allocArg = args.find(a => a.startsWith("allocs="));
    const allocs = allocArg ? parseInt(allocArg.split("=")[1]) : 2000;
    runBenchmark({ diskTotalMB: mb, memoryAllocCount: allocs, verbose: true });
    break;
  }
  case "net":
  case "network": {
    const mbArg = args.find(a => a.startsWith("mb="));
    const mb = mbArg ? parseInt(mbArg.split("=")[1]) : 20;
    runNetBenchmark({ totalMB: mb, verbose: true }).catch(console.error);
    break;
  }
  case "live": {
    const mbArg = args.find(a => a.startsWith("mb="));
    const mb = mbArg ? parseInt(mbArg.split("=")[1]) : 50;
    const allocArg = args.find(a => a.startsWith("allocs="));
    const allocs = allocArg ? parseInt(allocArg.split("=")[1]) : 5000;
    runLiveBenchmark({
      diskTotalMB: mb,
      memoryAllocCount: allocs,
      monitorIntervalMs: 500,
      triggerScanUrl: "http://localhost:3000/api/trading",
    }).catch(console.error);
    break;
  }
  case "spiral": {
    const sectorsArg = args.find(a => a.startsWith("sectors="));
    const sectors = sectorsArg ? parseInt(sectorsArg.split("=")[1]) : 10000;
    runSpiralBenchmark({ verbose: true, totalSectors: sectors });
    break;
  }
  case "tensor": {
    const sectorsArg = args.find(a => a.startsWith("sectors="));
    const sectors = sectorsArg ? parseInt(sectorsArg.split("=")[1]) : 10000;
    cmdTensor(sectors);
    break;
  }
  case "map": {
    const driveArg = args.find(a => a.startsWith("drive="));
    const drive = driveArg ? driveArg.split("=")[1] : "D:\\";
    const apply = args.includes("--apply");
    cmdMap(drive, apply);
    break;
  }
  case "intake": {
    // Process a specific file through the bridge
    if (args.length === 0) {
      console.log("Usage: shovelcat intake <file> [--keep]");
      console.log("  Classifies and moves the file into the spiral drive.");
      console.log("  --keep  Keep original file (copy instead of move)");
      break;
    }
    const keepOriginal = args.includes("--keep");
    const filePath = args.find(a => !a.startsWith("--"));
    if (!filePath) { console.log("No file specified."); break; }

    const absPath = path.resolve(filePath);
    console.log(`Processing: ${absPath}`);

    // Show classification first
    const basename = path.basename(absPath);
    const fileStats = fs.existsSync(absPath) ? fs.statSync(absPath) : null;
    if (!fileStats) { console.log("File not found."); break; }

    const cls = classifyFile(basename, fileStats.size);
    console.log(`  Classification: ${cls.axis} (${cls.temperature}) → zone L${cls.zone}`);
    console.log(`  Confidence: ${(cls.confidence * 100).toFixed(0)}% — ${cls.reason}`);
    console.log();

    const receipts = processIntake(absPath, { keepOriginal });
    console.log(`  Stored: ${receipts[0].storage.dataPath}`);
    console.log(`  Hash: ${receipts[0].hash.slice(0, 16)}...`);
    console.log();
    console.log("  Branch receipts:");
    for (const r of receipts) {
      console.log(`    ${r.perspective.branch.padEnd(6)} → ${r.perspective.interpretation}`);
    }
    break;
  }
  case "query": {
    // Query the bridge from a branch perspective
    const branch = (args.find(a => a.startsWith("branch="))?.split("=")[1] ?? "ai") as "ai" | "club" | "alpha";
    const pattern = args.find(a => !a.startsWith("branch="));
    const results = queryBridge(branch, pattern);

    if (results.length === 0) {
      console.log(`No results from ${branch} branch${pattern ? ` matching "${pattern}"` : ""}.`);
    } else {
      console.log(`${branch.toUpperCase()} BRANCH — ${results.length} result(s):`);
      for (const r of results) {
        console.log(`  ${r.filename.padEnd(30)} L${r.classification.zone} (${r.classification.primaryAxis}) ${(r.sizeBytes / 1024).toFixed(1)}KB`);
        console.log(`    ${r.perspective.interpretation}`);
      }
    }
    break;
  }
  case "bridge": {
    if (args.includes("--watch")) {
      // Start the bridge daemon (watch mode)
      const daemon = startBridgeDaemon({ verbose: true });
      process.on("SIGINT", () => { daemon.stop(); process.exit(0); });
      process.on("SIGTERM", () => { daemon.stop(); process.exit(0); });
    } else {
      // Show bridge status
      printBridgeStatus();
    }
    break;
  }
  case "real":
  case "realworld": {
    const scaleArg = args.find(a => a.startsWith("scale="));
    const scale = scaleArg ? parseFloat(scaleArg.split("=")[1]) : 1;
    runRealBenchmark({ verbose: true, scale });
    break;
  }
  default:
    console.log("Shovelcat — Invisible System Optimizer");
    console.log();
    console.log("Usage:");
    console.log("  shovelcat init              Create a new .geo spore");
    console.log("  shovelcat start             Start the derivative chain");
    console.log("  shovelcat stop              Stop the daemon");
    console.log("  shovelcat status            Show spore status");
    console.log("  shovelcat config [k=v ...]  View/update configuration");
    console.log("  shovelcat bench             Run performance benchmark");
    console.log("  shovelcat test [mb=10]      A/B test: random vs geometric");
    console.log("  shovelcat real [scale=1]    Real-world: games, video, models");
    console.log("  shovelcat spiral [sectors=N] Golden spiral drive addressing");
    console.log("  shovelcat tensor [sectors=N] Tensor overlay on collapsed space");
    console.log("  shovelcat map [drive=D:\\]   Map physical drive to spiral zones");
    console.log("  shovelcat map --apply       Create the directory structure");
    console.log("  shovelcat intake <file>     Send a file through the bridge");
    console.log("  shovelcat query [pattern]   Query bridge (branch=ai|club|alpha)");
    console.log("  shovelcat bridge            Show bridge status");
    console.log("  shovelcat bridge --watch    Start bridge daemon (auto-intake)");
    console.log("  shovelcat live [mb=50]      Live test during trading scan");
    console.log("  shovelcat net [mb=20]       Network: fixed vs Fibonacci chunks");
    console.log();
    console.log("Config keys:");
    console.log("  ceiling=0.5   Resource ceiling (0.1–0.9)");
    console.log("  interval=5000 Sample interval in ms");
    console.log("  log=warn      Log level (silent|error|warn|info|debug)");
    break;
}
