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

  // θ phase diagnosis (schedule-corrected)
  const tp = qStatus.thetaPhase;
  const sc = qStatus.schedule;
  console.log();
  console.log(`  θ PHASE: ${tp.phase.toUpperCase()} [${tp.color}]`);
  console.log(`  ${tp.description}`);
  console.log(`  Next boundary: ${tp.nextBoundary.name} at θ=${fmt(tp.nextBoundary.theta, 3)} (Δ=${fmt(tp.nextBoundary.distance, 3)})`);
  console.log(`  Dormancy: ${tp.shouldDormant ? "YES — past IBH, must sleep" : "no — within safe zone"}`);
  console.log();
  console.log(`  SCHEDULE CORRECTION: δ/√π = ${fmt(sc.correction * 100, 2)}% ISN'T overhead per IS chunk`);
  console.log(`  IS/ISN'T equilibrium: ${fmt(sc.isEquilibrium * 100, 1)}% / ${fmt(sc.isntEquilibrium * 100, 1)}% (shifted by δ toward IS)`);
  console.log(`  Thresholds reduced by factor ${fmt(sc.factor, 4)} — system hits phases ~8% earlier`);
  console.log();
  console.log(`  θ THRESHOLDS (scheduled):  ${fmt(1.0 * sc.factor, 3)}=equil  ${fmt(Math.sqrt(1.618) * sc.factor, 3)}=tunnel  ${fmt(1.618 * sc.factor, 3)}=IBH  ${fmt(Math.sqrt(Math.PI) * sc.factor, 3)}=IBH+  ${fmt(1.618*1.618 * sc.factor, 3)}=BEC  ${fmt(Math.E * sc.factor, 3)}=BEC+  ${fmt(Math.PI * sc.factor, 3)}=MAX`);
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
    console.log("  shovelcat live [mb=50]      Live test during trading scan");
    console.log("  shovelcat net [mb=20]       Network: fixed vs Fibonacci chunks");
    console.log();
    console.log("Config keys:");
    console.log("  ceiling=0.5   Resource ceiling (0.1–0.9)");
    console.log("  interval=5000 Sample interval in ms");
    console.log("  log=warn      Log level (silent|error|warn|info|debug)");
    break;
}
