/**
 * REAL-WORLD BENCHMARK — Games, Video, Model Loading
 * ===================================================
 *
 * The synthetic benchmark (random 4KB blocks) tests the WORST case for
 * geometric allocation — no structure to exploit. Real data has hierarchy:
 *
 *   GAME ASSET LOADING:
 *     Config (tiny) → Shaders (small) → Audio (medium) → Textures (large) → World (huge)
 *     Access pattern: sequential burst at load, then hot-set with random seeks
 *
 *   VIDEO STREAMING:
 *     Headers (tiny) → I-frames (large) → P-frames (medium) → B-frames (small)
 *     Access pattern: sequential read, predictable cadence, large buffers
 *
 *   MODEL LOADING (AI/ML):
 *     Metadata (tiny) → Embeddings (medium) → Attention (large) → FFN (huge)
 *     Access pattern: sequential read, layer-by-layer, single pass
 *
 *   SUSTAINED MIXED I/O:
 *     Read + write simultaneously, with locality (adjacent chunks accessed together)
 *     This is the "playing a game while it streams world data" scenario
 *
 * Each test compares:
 *   RANDOM: uniform chunk sizes (what most software does by default)
 *   FIBONACCI: h_info-scaled geometric chunks (Shovelcat approach)
 *
 * The key insight: Fibonacci chunks match natural data hierarchies,
 * which improves cache locality, reduces fragmentation, and lets the
 * OS prefetcher predict access patterns.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { DerivativeChainEngine } from "./derivative-chain";
import { computeHardwareQuaternion, computeLandauer, getThetaPhase } from "./quaternion-chain";
import { fibonacciChunkSizes } from "./quaternion-chain";

// ── Helpers ──────────────────────────────────────────────────────────────

function hrMs(start: [number, number]): number {
  const [s, ns] = process.hrtime(start);
  return s * 1000 + ns / 1_000_000;
}

function fmt(n: number, d: number = 2): string {
  return n.toFixed(d);
}

function makeTempDir(label: string): string {
  const dir = path.join(require("os").tmpdir(), `shovelcat-real-${label}-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanDir(dir: string): void {
  try {
    const files = fs.readdirSync(dir);
    for (const f of files) fs.unlinkSync(path.join(dir, f));
    fs.rmdirSync(dir);
  } catch { /* ok */ }
}

function randomData(size: number): Buffer {
  return crypto.randomBytes(size);
}

// ── Asset Definitions ────────────────────────────────────────────────────
// Real software loads data in LAYERS — small metadata first, then
// progressively larger content. This is the hierarchy that Fibonacci matches.

interface AssetLayer {
  name: string;
  /** How many assets at this layer */
  count: number;
  /** Size range for random approach [min, max] in bytes */
  randomSize: [number, number];
  /** Fibonacci level for geometric approach */
  fibLevel: number;
  /** Access pattern after initial load */
  rereadProbability: number;
}

const GAME_ASSETS: AssetLayer[] = [
  { name: "config",   count: 20,  randomSize: [256, 2048],     fibLevel: 0, rereadProbability: 0.1 },
  { name: "shaders",  count: 50,  randomSize: [512, 4096],     fibLevel: 1, rereadProbability: 0.3 },
  { name: "audio",    count: 30,  randomSize: [2048, 8192],    fibLevel: 3, rereadProbability: 0.5 },
  { name: "textures", count: 80,  randomSize: [4096, 32768],   fibLevel: 5, rereadProbability: 0.8 },
  { name: "world",    count: 15,  randomSize: [16384, 65536],  fibLevel: 7, rereadProbability: 0.2 },
];

const VIDEO_FRAMES: AssetLayer[] = [
  { name: "headers",   count: 10,  randomSize: [64, 512],       fibLevel: 0, rereadProbability: 0.0 },
  { name: "b-frames",  count: 200, randomSize: [512, 2048],     fibLevel: 1, rereadProbability: 0.0 },
  { name: "p-frames",  count: 100, randomSize: [1024, 4096],    fibLevel: 2, rereadProbability: 0.0 },
  { name: "i-frames",  count: 30,  randomSize: [4096, 16384],   fibLevel: 4, rereadProbability: 0.0 },
  { name: "keyframes", count: 10,  randomSize: [8192, 32768],   fibLevel: 6, rereadProbability: 0.0 },
];

const MODEL_LAYERS: AssetLayer[] = [
  { name: "metadata",   count: 5,   randomSize: [128, 1024],     fibLevel: 0, rereadProbability: 0.0 },
  { name: "tokenizer",  count: 3,   randomSize: [1024, 4096],    fibLevel: 2, rereadProbability: 0.0 },
  { name: "embeddings", count: 10,  randomSize: [4096, 16384],   fibLevel: 4, rereadProbability: 0.0 },
  { name: "attention",  count: 40,  randomSize: [8192, 32768],   fibLevel: 5, rereadProbability: 0.0 },
  { name: "ffn",        count: 40,  randomSize: [16384, 65536],  fibLevel: 7, rereadProbability: 0.0 },
];

// ── Workload Runner ──────────────────────────────────────────────────────

interface WorkloadResult {
  label: string;
  method: "random" | "fibonacci";
  /** Initial sequential load */
  loadMs: number;
  /** Re-reads (hot set access) */
  rereadMs: number;
  /** Total time */
  totalMs: number;
  /** Total bytes processed */
  totalBytes: number;
  /** Throughput MB/s */
  throughputMBps: number;
  /** Number of files */
  fileCount: number;
  /** Size variance (fragmentation proxy) */
  sizeVariance: number;
  /** Cache friendliness: sequential hit ratio */
  sequentialRatio: number;
}

function runWorkload(
  workloadName: string,
  layers: AssetLayer[],
  method: "random" | "fibonacci",
  rerounds: number,
): WorkloadResult {
  const dir = makeTempDir(`${workloadName}-${method}`);
  const chunks = fibonacciChunkSizes();
  const files: Array<{ path: string; size: number; rereadProb: number }> = [];
  const sizes: number[] = [];
  let totalBytes = 0;

  // ── Phase 1: Sequential load (write all assets) ──
  const loadStart = process.hrtime();

  for (const layer of layers) {
    for (let i = 0; i < layer.count; i++) {
      let size: number;
      if (method === "random") {
        // Random: uniform distribution within the layer's range
        size = layer.randomSize[0] + Math.floor(Math.random() * (layer.randomSize[1] - layer.randomSize[0]));
      } else {
        // Fibonacci: use the h_info-scaled chunk for this layer's level
        size = chunks.levels[layer.fibLevel].scheduledBytes;
      }

      const fname = `${layer.name}_${i}.bin`;
      const fpath = path.join(dir, fname);
      fs.writeFileSync(fpath, randomData(size));
      files.push({ path: fpath, size, rereadProb: layer.rereadProbability });
      sizes.push(size);
      totalBytes += size;
    }
  }

  // Read all back sequentially (simulating initial load into memory)
  for (const f of files) {
    fs.readFileSync(f.path);
  }
  const loadMs = hrMs(loadStart);

  // ── Phase 2: Re-reads (hot set — simulating gameplay/playback) ──
  // In real use, some assets get re-read constantly (textures, audio loops)
  // while others are read once (config, headers)
  const rereadStart = process.hrtime();
  let rereads = 0;

  for (let round = 0; round < rerounds; round++) {
    for (const f of files) {
      if (Math.random() < f.rereadProb) {
        fs.readFileSync(f.path);
        rereads++;
        totalBytes += f.size;
      }
    }
  }
  const rereadMs = hrMs(rereadStart);

  // ── Metrics ──
  // Size variance: how much adjacent chunks differ (lower = more cache friendly)
  let sizeVar = 0;
  for (let i = 1; i < sizes.length; i++) {
    sizeVar += Math.abs(sizes[i] - sizes[i - 1]);
  }
  const maxSize = Math.max(...sizes, 1);
  const sizeVariance = sizeVar / (sizes.length * maxSize);

  // Sequential ratio: how many files are in ascending size order
  // (OS prefetcher works best with predictable patterns)
  let seqHits = 0;
  for (let i = 1; i < sizes.length; i++) {
    if (sizes[i] >= sizes[i - 1]) seqHits++;
  }
  const sequentialRatio = sizes.length > 1 ? seqHits / (sizes.length - 1) : 1;

  const totalMs = loadMs + rereadMs;

  cleanDir(dir);

  return {
    label: `${workloadName} (${method})`,
    method,
    loadMs,
    rereadMs,
    totalMs,
    totalBytes,
    throughputMBps: (totalBytes / 1_048_576) / (totalMs / 1000),
    fileCount: files.length,
    sizeVariance,
    sequentialRatio,
  };
}

// ── Memory Pool Test ─────────────────────────────────────────────────────
// Simulates GPU memory management: allocate textures/buffers, free some,
// allocate more, measure fragmentation over time

interface MemPoolResult {
  label: string;
  method: "random" | "fibonacci";
  /** Total allocation cycles */
  cycles: number;
  /** Total time */
  totalMs: number;
  /** Peak memory MB */
  peakMB: number;
  /** Final fragmentation (gap ratio) */
  fragmentation: number;
  /** How many allocations fit in the same peak */
  density: number;
  /** Average allocation time (µs) */
  avgAllocUs: number;
}

function runMemPool(
  method: "random" | "fibonacci",
  cycles: number,
  poolSize: number,
): MemPoolResult {
  const chunks = fibonacciChunkSizes();
  const pool: Array<{ buf: Buffer; size: number } | null> = new Array(poolSize).fill(null);
  let peakBytes = 0;
  let currentBytes = 0;
  let totalAllocs = 0;
  const allSizes: number[] = [];

  const start = process.hrtime();

  for (let cycle = 0; cycle < cycles; cycle++) {
    // Each cycle: allocate into ~60% of slots, free ~40%
    for (let slot = 0; slot < poolSize; slot++) {
      if (Math.random() < 0.6) {
        // Allocate
        let size: number;
        if (method === "random") {
          size = 1024 + Math.floor(Math.random() * 65536);
        } else {
          // Fibonacci: pick level based on "asset type" pattern
          // Small slots get small levels, large slots get large levels
          const level = Math.min(7, Math.floor((slot / poolSize) * 8));
          size = chunks.levels[level].scheduledBytes;
        }

        // Free old if occupied
        if (pool[slot]) {
          currentBytes -= pool[slot]!.size;
        }

        pool[slot] = { buf: Buffer.alloc(size), size };
        currentBytes += size;
        allSizes.push(size);
        totalAllocs++;

        if (currentBytes > peakBytes) peakBytes = currentBytes;
      } else {
        // Free
        if (pool[slot]) {
          currentBytes -= pool[slot]!.size;
          pool[slot] = null;
        }
      }
    }
  }

  const totalMs = hrMs(start);

  // Fragmentation: measure size variance of occupied slots (how scattered the pool is)
  const occupied = pool.filter(Boolean) as Array<{ buf: Buffer; size: number }>;
  let fragScore = 0;
  if (occupied.length > 1) {
    for (let i = 1; i < occupied.length; i++) {
      fragScore += Math.abs(occupied[i].size - occupied[i - 1].size);
    }
    fragScore /= occupied.length * (Math.max(...occupied.map(o => o.size)) || 1);
  }

  // Density: how many allocations per MB of peak
  const peakMB = peakBytes / 1_048_576;
  const density = totalAllocs / Math.max(0.001, peakMB);

  return {
    label: method,
    method,
    cycles,
    totalMs,
    peakMB,
    fragmentation: fragScore,
    density,
    avgAllocUs: (totalMs * 1000) / totalAllocs,
  };
}

// ── Sustained Mixed I/O ──────────────────────────────────────────────────
// Simulates playing a game: constantly reading textures while writing
// save data, streaming new world chunks, freeing old ones

interface MixedIOResult {
  label: string;
  method: "random" | "fibonacci";
  readMs: number;
  writeMs: number;
  totalMs: number;
  readMBps: number;
  writeMBps: number;
  /** Read/write interleaving — how well the system handles both at once */
  interleaveEfficiency: number;
}

function runMixedIO(
  method: "random" | "fibonacci",
  durationCycles: number,
): MixedIOResult {
  const dir = makeTempDir(`mixed-${method}`);
  const chunks = fibonacciChunkSizes();

  let readBytes = 0;
  let writeBytes = 0;
  let readMs = 0;
  let writeMs = 0;

  // Pre-populate with "world chunks" (things to read from)
  const worldFiles: string[] = [];
  for (let i = 0; i < 50; i++) {
    const size = method === "random"
      ? 2048 + Math.floor(Math.random() * 30000)
      : chunks.levels[Math.min(7, Math.floor(i / 7))].scheduledBytes;
    const fname = `world_${i}.bin`;
    fs.writeFileSync(path.join(dir, fname), randomData(size));
    worldFiles.push(fname);
  }

  // Simulation: each cycle reads some world data and writes some save/stream data
  for (let cycle = 0; cycle < durationCycles; cycle++) {
    // READ: load 3-5 random world chunks (texture lookups during gameplay)
    const readCount = 3 + Math.floor(Math.random() * 3);
    const rStart = process.hrtime();
    for (let r = 0; r < readCount; r++) {
      const idx = Math.floor(Math.random() * worldFiles.length);
      const data = fs.readFileSync(path.join(dir, worldFiles[idx]));
      readBytes += data.length;
    }
    readMs += hrMs(rStart);

    // WRITE: save 1-2 chunks (autosave, new world streaming in)
    const writeCount = 1 + Math.floor(Math.random() * 2);
    const wStart = process.hrtime();
    for (let w = 0; w < writeCount; w++) {
      const size = method === "random"
        ? 1024 + Math.floor(Math.random() * 16384)
        : chunks.levels[2 + Math.floor(Math.random() * 4)].scheduledBytes;
      const fname = `save_${cycle}_${w}.bin`;
      fs.writeFileSync(path.join(dir, fname), randomData(size));
      writeBytes += size;
    }
    writeMs += hrMs(wStart);

    // Every 10 cycles, clean up old save files (simulating world unloading)
    if (cycle % 10 === 9) {
      try {
        const saves = fs.readdirSync(dir).filter(f => f.startsWith("save_"));
        // Remove oldest half
        const toRemove = saves.slice(0, Math.floor(saves.length / 2));
        for (const f of toRemove) {
          try { fs.unlinkSync(path.join(dir, f)); } catch { /* ok */ }
        }
      } catch { /* ok */ }
    }
  }

  const totalMs = readMs + writeMs;
  const readMBps = (readBytes / 1_048_576) / (readMs / 1000);
  const writeMBps = (writeBytes / 1_048_576) / (writeMs / 1000);

  // Interleave efficiency: ratio of combined throughput to sum of individual
  // (1.0 = no penalty from mixing, <1.0 = contention hurts)
  const combinedMBps = ((readBytes + writeBytes) / 1_048_576) / (totalMs / 1000);
  const interleaveEfficiency = combinedMBps / (readMBps + writeMBps + 0.001);

  cleanDir(dir);

  return {
    label: method,
    method,
    readMs,
    writeMs,
    totalMs,
    readMBps,
    writeMBps,
    interleaveEfficiency,
  };
}

// ── Main Runner ──────────────────────────────────────────────────────────

export interface RealBenchResults {
  game: { random: WorkloadResult; fibonacci: WorkloadResult };
  video: { random: WorkloadResult; fibonacci: WorkloadResult };
  model: { random: WorkloadResult; fibonacci: WorkloadResult };
  memPool: { random: MemPoolResult; fibonacci: MemPoolResult };
  mixedIO: { random: MixedIOResult; fibonacci: MixedIOResult };
  quaternion: {
    normBefore: number;
    normAfter: number;
    phaseBefore: string;
    phaseAfter: string;
    thermalFactor: number;
    boltzmannFactor: number;
    eOverKT: number;
  };
}

export function runRealBenchmark(options: {
  verbose?: boolean;
  scale?: number;  // 1 = default, 2 = 2x more data, etc.
} = {}): RealBenchResults {
  const verbose = options.verbose ?? true;
  const scale = options.scale ?? 1;
  const rerounds = Math.ceil(3 * scale);
  const memCycles = Math.ceil(20 * scale);
  const mixedCycles = Math.ceil(50 * scale);

  const engine = new DerivativeChainEngine({ maxHistory: 60 });
  for (let i = 0; i < 5; i++) engine.sample();

  // Quaternion state before
  const snapBefore = engine.sample();
  const derivBefore = engine.getDerivatives();
  const qBefore = computeHardwareQuaternion(snapBefore, derivBefore);
  const avgVoidBefore = (qBefore.w.streams.void_ + qBefore.i.streams.void_ + qBefore.j.streams.void_ + qBefore.k.streams.void_) / 4;
  const landBefore = computeLandauer(
    snapBefore.gpuTempC, snapBefore.gpuTdpTempC,
    snapBefore.cpuTempC, snapBefore.cpuTjMaxC,
    qBefore.observerDominance, avgVoidBefore,
  );
  const phaseBefore = getThetaPhase(qBefore.norm, landBefore.combinedFactor);

  if (verbose) {
    console.log("SHOVELCAT REAL-WORLD BENCHMARK");
    console.log("═".repeat(70));
    console.log(`Scale: ${scale}x | Re-read rounds: ${rerounds} | Mem cycles: ${memCycles} | Mixed cycles: ${mixedCycles}`);
    console.log(`Baseline: |q|=${fmt(qBefore.norm, 3)} phase=${phaseBefore.phase} Boltzmann=${fmt(landBefore.pressureFactor, 4)}`);
    console.log();
  }

  // ══════════════════════════════════════════════════════════════
  // TEST 1: GAME ASSET LOADING
  // ══════════════════════════════════════════════════════════════

  if (verbose) {
    console.log("TEST 1: GAME ASSET LOADING (config → shaders → audio → textures → world)");
    console.log("─".repeat(70));
  }

  const gameRand = runWorkload("game", GAME_ASSETS, "random", rerounds);
  const gameFib = runWorkload("game", GAME_ASSETS, "fibonacci", rerounds);

  if (verbose) {
    printWorkloadComparison(gameRand, gameFib);
  }

  // ══════════════════════════════════════════════════════════════
  // TEST 2: VIDEO STREAMING
  // ══════════════════════════════════════════════════════════════

  if (verbose) {
    console.log("TEST 2: VIDEO STREAMING (headers → B-frames → P-frames → I-frames → keyframes)");
    console.log("─".repeat(70));
  }

  const videoRand = runWorkload("video", VIDEO_FRAMES, "random", 0);  // no re-reads in video
  const videoFib = runWorkload("video", VIDEO_FRAMES, "fibonacci", 0);

  if (verbose) {
    printWorkloadComparison(videoRand, videoFib);
  }

  // ══════════════════════════════════════════════════════════════
  // TEST 3: MODEL LOADING
  // ══════════════════════════════════════════════════════════════

  if (verbose) {
    console.log("TEST 3: MODEL LOADING (metadata → tokenizer → embeddings → attention → FFN)");
    console.log("─".repeat(70));
  }

  const modelRand = runWorkload("model", MODEL_LAYERS, "random", 0);  // single pass
  const modelFib = runWorkload("model", MODEL_LAYERS, "fibonacci", 0);

  if (verbose) {
    printWorkloadComparison(modelRand, modelFib);
  }

  // ══════════════════════════════════════════════════════════════
  // TEST 4: MEMORY POOL (GPU buffer simulation)
  // ══════════════════════════════════════════════════════════════

  if (verbose) {
    console.log("TEST 4: MEMORY POOL (alloc/free cycles — simulating GPU buffer management)");
    console.log("─".repeat(70));
  }

  const memRand = runMemPool("random", memCycles, 200);
  const memFib = runMemPool("fibonacci", memCycles, 200);

  if (verbose) {
    console.log();
    console.log(`  ${"Method".padEnd(12)} ${"Cycles".padStart(7)} ${"Time ms".padStart(9)} ${"Peak MB".padStart(9)} ${"Frag".padStart(7)} ${"Density".padStart(9)} ${"µs/alloc".padStart(9)}`);
    console.log("  " + "─".repeat(62));
    for (const r of [memRand, memFib]) {
      console.log(
        `  ${r.label.padEnd(12)} ${String(r.cycles).padStart(7)} ` +
        `${fmt(r.totalMs, 1).padStart(9)} ${fmt(r.peakMB, 2).padStart(9)} ` +
        `${fmt(r.fragmentation, 4).padStart(7)} ${fmt(r.density, 0).padStart(9)} ` +
        `${fmt(r.avgAllocUs, 2).padStart(9)}`
      );
    }
    const fragReduce = memRand.fragmentation > 0
      ? ((1 - memFib.fragmentation / memRand.fragmentation) * 100)
      : 0;
    const peakReduce = memRand.peakMB > 0
      ? ((1 - memFib.peakMB / memRand.peakMB) * 100)
      : 0;
    console.log();
    console.log(`  Fragmentation: ${fragReduce > 0 ? fmt(fragReduce, 1) + "% lower" : fmt(-fragReduce, 1) + "% higher"} with Fibonacci`);
    console.log(`  Peak memory:   ${peakReduce > 0 ? fmt(peakReduce, 1) + "% less" : fmt(-peakReduce, 1) + "% more"} with Fibonacci`);
    console.log();
  }

  // ══════════════════════════════════════════════════════════════
  // TEST 5: SUSTAINED MIXED I/O (gameplay simulation)
  // ══════════════════════════════════════════════════════════════

  if (verbose) {
    console.log("TEST 5: SUSTAINED MIXED I/O (read textures + write saves simultaneously)");
    console.log("─".repeat(70));
  }

  const mixRand = runMixedIO("random", mixedCycles);
  const mixFib = runMixedIO("fibonacci", mixedCycles);

  if (verbose) {
    console.log();
    console.log(`  ${"Method".padEnd(12)} ${"Read MB/s".padStart(10)} ${"Write MB/s".padStart(11)} ${"Total ms".padStart(10)} ${"Interleave".padStart(11)}`);
    console.log("  " + "─".repeat(54));
    for (const r of [mixRand, mixFib]) {
      console.log(
        `  ${r.label.padEnd(12)} ${fmt(r.readMBps, 1).padStart(10)} ` +
        `${fmt(r.writeMBps, 1).padStart(11)} ${fmt(r.totalMs, 1).padStart(10)} ` +
        `${fmt(r.interleaveEfficiency * 100, 1).padStart(10)}%`
      );
    }
    const mixSpeedup = mixRand.totalMs / mixFib.totalMs;
    console.log();
    console.log(`  Mixed I/O: Fibonacci is ${fmt(mixSpeedup, 2)}x ${mixSpeedup > 1 ? "faster" : "slower"}`);
    console.log();
  }

  // ══════════════════════════════════════════════════════════════
  // QUATERNION STATE AFTER ALL TESTS
  // ══════════════════════════════════════════════════════════════

  const snapAfter = engine.sample();
  const derivAfter = engine.getDerivatives();
  const qAfter = computeHardwareQuaternion(snapAfter, derivAfter);
  const avgVoidAfter = (qAfter.w.streams.void_ + qAfter.i.streams.void_ + qAfter.j.streams.void_ + qAfter.k.streams.void_) / 4;
  const landAfter = computeLandauer(
    snapAfter.gpuTempC, snapAfter.gpuTdpTempC,
    snapAfter.cpuTempC, snapAfter.cpuTjMaxC,
    qAfter.observerDominance, avgVoidAfter,
  );
  const phaseAfter = getThetaPhase(qAfter.norm, landAfter.combinedFactor);

  // ══════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════

  if (verbose) {
    console.log("SUMMARY");
    console.log("═".repeat(70));
    console.log();

    const results = [
      { name: "Game loading",   rand: gameRand,  fib: gameFib },
      { name: "Video stream",   rand: videoRand, fib: videoFib },
      { name: "Model loading",  rand: modelRand, fib: modelFib },
    ];

    console.log(`  ${"Workload".padEnd(16)} ${"Random ms".padStart(10)} ${"Fib ms".padStart(10)} ${"Speedup".padStart(8)} ${"Frag Δ".padStart(8)} ${"Seq Δ".padStart(8)}`);
    console.log("  " + "─".repeat(60));

    for (const r of results) {
      const speedup = r.rand.totalMs / r.fib.totalMs;
      const fragDelta = r.fib.sizeVariance - r.rand.sizeVariance;
      const seqDelta = r.fib.sequentialRatio - r.rand.sequentialRatio;
      console.log(
        `  ${r.name.padEnd(16)} ${fmt(r.rand.totalMs, 1).padStart(10)} ` +
        `${fmt(r.fib.totalMs, 1).padStart(10)} ${fmt(speedup, 2).padStart(7)}x ` +
        `${(fragDelta < 0 ? fmt(fragDelta, 3) : "+" + fmt(fragDelta, 3)).padStart(8)} ` +
        `${(seqDelta > 0 ? "+" + fmt(seqDelta * 100, 1) + "%" : fmt(seqDelta * 100, 1) + "%").padStart(8)}`
      );
    }

    console.log();
    console.log(`  Memory pool:    frag ${fmt(memRand.fragmentation, 4)} → ${fmt(memFib.fragmentation, 4)}, peak ${fmt(memRand.peakMB, 1)}MB → ${fmt(memFib.peakMB, 1)}MB`);

    const mixSpeed = mixRand.totalMs / mixFib.totalMs;
    console.log(`  Mixed I/O:      ${fmt(mixSpeed, 2)}x ${mixSpeed > 1 ? "faster" : "slower"}, interleave ${fmt(mixRand.interleaveEfficiency * 100, 1)}% → ${fmt(mixFib.interleaveEfficiency * 100, 1)}%`);

    console.log();
    console.log(`  QUATERNION IMPACT:`);
    console.log(`    Before: |q|=${fmt(qBefore.norm, 3)} → ${phaseBefore.phase}  E/kT=${fmt(landBefore.eOverKT, 3)} Boltzmann=${fmt(landBefore.pressureFactor, 4)}`);
    console.log(`    After:  |q|=${fmt(qAfter.norm, 3)} → ${phaseAfter.phase}  E/kT=${fmt(landAfter.eOverKT, 3)} Boltzmann=${fmt(landAfter.pressureFactor, 4)}`);

    // Overall verdict
    console.log();
    const wins = results.filter(r => r.rand.totalMs > r.fib.totalMs).length;
    const fragWins = (memFib.fragmentation < memRand.fragmentation ? 1 : 0) + (mixSpeed > 1 ? 1 : 0);
    const totalWins = wins + fragWins;
    const totalTests = results.length + 2;

    if (totalWins >= Math.ceil(totalTests * 0.6)) {
      console.log(`  VERDICT: Fibonacci wins ${totalWins}/${totalTests} real-world tests.`);
      console.log(`  Geometric allocation matches natural data hierarchy — your hardware does more with less.`);
    } else if (totalWins >= Math.ceil(totalTests * 0.4)) {
      console.log(`  VERDICT: Mixed results (${totalWins}/${totalTests}).`);
      console.log(`  Fibonacci wins on structured workloads; random is competitive on flat I/O.`);
    } else {
      console.log(`  VERDICT: Random wins ${totalTests - totalWins}/${totalTests}.`);
      console.log(`  This hardware/OS may be optimizing flat patterns well. Try scale=2 or scale=5 for heavier load.`);
    }
  }

  return {
    game: { random: gameRand, fibonacci: gameFib },
    video: { random: videoRand, fibonacci: videoFib },
    model: { random: modelRand, fibonacci: modelFib },
    memPool: { random: memRand, fibonacci: memFib },
    mixedIO: { random: mixRand, fibonacci: mixFib },
    quaternion: {
      normBefore: qBefore.norm,
      normAfter: qAfter.norm,
      phaseBefore: phaseBefore.phase,
      phaseAfter: phaseAfter.phase,
      thermalFactor: landAfter.thermalFactor,
      boltzmannFactor: landAfter.pressureFactor,
      eOverKT: landAfter.eOverKT,
    },
  };
}

// ── Display Helper ───────────────────────────────────────────────────────

function printWorkloadComparison(rand: WorkloadResult, fib: WorkloadResult): void {
  console.log();
  console.log(`  ${"Method".padEnd(22)} ${"Load ms".padStart(9)} ${"Re-read ms".padStart(11)} ${"Total ms".padStart(10)} ${"MB/s".padStart(8)} ${"Files".padStart(6)} ${"Frag".padStart(7)} ${"Seq%".padStart(6)}`);
  console.log("  " + "─".repeat(69));
  for (const r of [rand, fib]) {
    console.log(
      `  ${r.label.padEnd(22)} ${fmt(r.loadMs, 1).padStart(9)} ` +
      `${fmt(r.rereadMs, 1).padStart(11)} ${fmt(r.totalMs, 1).padStart(10)} ` +
      `${fmt(r.throughputMBps, 1).padStart(8)} ${String(r.fileCount).padStart(6)} ` +
      `${fmt(r.sizeVariance, 4).padStart(7)} ${fmt(r.sequentialRatio * 100, 0).padStart(5)}%`
    );
  }

  const speedup = rand.totalMs / fib.totalMs;
  const fragDelta = fib.sizeVariance - rand.sizeVariance;
  console.log();
  console.log(`  Speed: ${fmt(speedup, 2)}x ${speedup > 1 ? "FASTER" : "slower"} with Fibonacci`);
  console.log(`  Frag:  ${fragDelta < 0 ? fmt(-fragDelta * 100, 1) + "% LOWER" : fmt(fragDelta * 100, 1) + "% higher"} variance`);
  console.log(`  Seq:   ${fmt(fib.sequentialRatio * 100, 0)}% vs ${fmt(rand.sequentialRatio * 100, 0)}% sequential (prefetcher friendliness)`);
  console.log();
}
