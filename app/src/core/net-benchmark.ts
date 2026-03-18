/**
 * NETWORK BENCHMARK — Fixed vs Fibonacci Transfer Chunks
 * ======================================================
 *
 * Tests: write data through a local TCP socket in fixed chunks
 * vs Fibonacci-scaled chunks, measuring throughput and overhead.
 *
 * Also validates the h_info → TCP MSS relationship:
 *   h_info × fib(2) = 1352 bytes ≈ TCP MSS (1460 bytes)
 *   ratio ≈ 1.08 — theory predicts packet size within 8%
 */

import * as net from "net";
import * as crypto from "crypto";
import { NetChainEngine } from "./net-chain";

// ── Constants ────────────────────────────────────────────────────────────

const DELTA = Math.PI - 3;
const SQRT_PI = Math.sqrt(Math.PI);
const SCHEDULE = DELTA / SQRT_PI;            // ≈ 0.07989 — ISN'T overhead
const BASE_BLOCK = 4096;
const H_INFO = Math.round(BASE_BLOCK * DELTA / (1 - DELTA));
const H_INFO_SCHED = H_INFO * (1 + SCHEDULE);
const FIB = [1, 1, 2, 3, 5, 8, 13, 21];

function fmt(n: number, d: number = 2): string { return n.toFixed(d); }

function hrMs(start: [number, number]): number {
  const [s, ns] = process.hrtime(start);
  return s * 1000 + ns / 1_000_000;
}

// ── Socket Transfer Test ─────────────────────────────────────────────────

interface TransferResult {
  label: string;
  totalBytes: number;
  chunkSize: number;
  chunkCount: number;
  transferMs: number;
  throughputMBps: number;
  overheadPct: number;  // chunk header/framing overhead estimate
}

function transferTest(
  label: string,
  totalBytes: number,
  chunkSize: number,
): Promise<TransferResult> {
  return new Promise((resolve, reject) => {
    let received = 0;
    const chunkCount = Math.ceil(totalBytes / chunkSize);

    // Create local TCP server
    const server = net.createServer((socket) => {
      socket.on("data", (data) => {
        received += data.length;
        if (received >= totalBytes) {
          socket.end();
        }
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as net.AddressInfo;
      const client = net.createConnection(addr.port, "127.0.0.1", () => {
        const chunk = crypto.randomBytes(chunkSize);
        let sent = 0;
        const start = process.hrtime();

        const sendNext = () => {
          while (sent < totalBytes) {
            const remaining = totalBytes - sent;
            const toSend = remaining < chunkSize ? remaining : chunkSize;
            const buf = toSend === chunkSize ? chunk : chunk.subarray(0, toSend);
            const ok = client.write(buf);
            sent += toSend;
            if (!ok) {
              client.once("drain", sendNext);
              return;
            }
          }
          client.end();
        };

        client.on("close", () => {
          const ms = hrMs(start);
          server.close();

          // Overhead estimate: each chunk has TCP header (~40 bytes) overhead
          const headerBytes = chunkCount * 40;
          const overheadPct = (headerBytes / totalBytes) * 100;

          resolve({
            label,
            totalBytes,
            chunkSize,
            chunkCount,
            transferMs: ms,
            throughputMBps: (totalBytes / 1_048_576) / (ms / 1000),
            overheadPct,
          });
        });

        sendNext();
      });

      client.on("error", reject);
    });

    server.on("error", reject);
  });
}

// ── Fibonacci Ramp Transfer ──────────────────────────────────────────────

function fibTransferTest(totalBytes: number): Promise<TransferResult> {
  return new Promise((resolve, reject) => {
    let received = 0;
    let totalChunks = 0;

    const server = net.createServer((socket) => {
      socket.on("data", (data) => {
        received += data.length;
        if (received >= totalBytes) {
          socket.end();
        }
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as net.AddressInfo;
      const client = net.createConnection(addr.port, "127.0.0.1", () => {
        let sent = 0;
        const start = process.hrtime();

        // Build Fibonacci ramp plan
        const plan: Array<{ size: number; count: number }> = [];
        let remaining = totalBytes;

        // Ramp up: levels 2→6
        for (let l = 2; l <= 6 && remaining > 0; l++) {
          const size = H_INFO * FIB[l];
          const count = Math.min(FIB[l], Math.ceil(remaining / size));
          plan.push({ size, count });
          remaining -= size * count;
        }

        // Cruise at level 7
        if (remaining > 0) {
          const size = H_INFO * FIB[7];
          const count = Math.floor(remaining / size);
          if (count > 0) {
            plan.push({ size, count });
            remaining -= size * count;
          }
        }

        // Remainder
        if (remaining > 0) {
          plan.push({ size: remaining, count: 1 });
        }

        // Flatten into send queue
        const chunks: Buffer[] = [];
        for (const p of plan) {
          const buf = crypto.randomBytes(p.size);
          for (let i = 0; i < p.count; i++) {
            chunks.push(p.size === buf.length ? buf : crypto.randomBytes(p.size));
            totalChunks++;
          }
        }

        let idx = 0;
        const sendNext = () => {
          while (idx < chunks.length) {
            const ok = client.write(chunks[idx]);
            sent += chunks[idx].length;
            idx++;
            if (!ok) {
              client.once("drain", sendNext);
              return;
            }
          }
          client.end();
        };

        client.on("close", () => {
          const ms = hrMs(start);
          server.close();

          const headerBytes = totalChunks * 40;
          const overheadPct = (headerBytes / totalBytes) * 100;

          resolve({
            label: "Fibonacci ramp (2→7→taper)",
            totalBytes,
            chunkSize: H_INFO * FIB[7],  // peak chunk
            chunkCount: totalChunks,
            transferMs: ms,
            throughputMBps: (totalBytes / 1_048_576) / (ms / 1000),
            overheadPct,
          });
        });

        sendNext();
      });

      client.on("error", reject);
    });

    server.on("error", reject);
  });
}

// ── Main Benchmark ───────────────────────────────────────────────────────

export async function runNetBenchmark(options: {
  totalMB?: number;
  verbose?: boolean;
} = {}): Promise<void> {
  const totalBytes = (options.totalMB ?? 20) * 1_048_576;
  const verbose = options.verbose ?? true;

  if (verbose) {
    console.log("SHOVELCAT NETWORK BENCHMARK");
    console.log("═".repeat(60));
    console.log(`Transfer size: ${options.totalMB ?? 20}MB per method (local TCP loopback)`);
    console.log();
  }

  // Theory validation — with schedule correction
  const pureFib2 = H_INFO * FIB[2];
  const schedFib2 = Math.round(H_INFO_SCHED * FIB[2]);
  const pureRatio = 1460 / pureFib2;
  const schedError = Math.abs(schedFib2 - 1460);

  if (verbose) {
    console.log("THEORY: h_info → TCP MSS RELATIONSHIP");
    console.log("─".repeat(60));
    console.log(`  δ = π - 3 = ${fmt(DELTA, 5)}`);
    console.log(`  √π = ${fmt(SQRT_PI, 5)}`);
    console.log(`  δ/√π = ${fmt(SCHEDULE, 5)} (schedule correction — ISN'T overhead per IS chunk)`);
    console.log();
    console.log(`  h_info (pure)      = 4096 × δ/(1-δ) = ${H_INFO} bytes`);
    console.log(`  h_info (scheduled) = ${H_INFO} × (1 + δ/√π) = ${Math.round(H_INFO_SCHED)} bytes`);
    console.log();
    console.log(`  BEFORE schedule correction:`);
    console.log(`    Pure fib(2) = ${pureFib2}B vs TCP MSS = 1460B → ratio ${fmt(pureRatio, 4)} (${fmt(Math.abs(1-pureRatio)*100, 1)}% gap)`);
    console.log(`  AFTER schedule correction:`);
    console.log(`    Scheduled fib(2) = ${schedFib2}B vs TCP MSS = 1460B → error ${schedError}B (${fmt(schedError/1460*100, 4)}%)`);
    console.log(`    h_info × fib(2) × (1 + δ/√π) = TCP MSS  ← schedule closes the gap exactly`);
    console.log();
    console.log(`  WHY: Every IS (forward) packet needs δ/√π = ${fmt(SCHEDULE*100, 2)}% for ISN'T`);
    console.log(`  (acknowledgment, return-path). TCP evolved this shape empirically.`);
    console.log();

    console.log("FIBONACCI CHUNK LEVELS (pure → scheduled)");
    console.log("─".repeat(60));
    for (let l = 0; l < 8; l++) {
      const pure = H_INFO * FIB[l];
      const sched = Math.round(H_INFO_SCHED * FIB[l]);
      const pLabel = pure < 1024 ? `${pure}B` : `${fmt(pure / 1024, 1)}KB`;
      const sLabel = sched < 1024 ? `${sched}B` : `${fmt(sched / 1024, 1)}KB`;
      const packets = Math.ceil(sched / 1460);
      console.log(`  Level ${l}: fib=${FIB[l]}  → ${pLabel.padEnd(8)} → ${sLabel.padEnd(8)} (${packets} TCP packet${packets > 1 ? "s" : ""})`);
    }
    console.log();
  }

  // Network chain status
  const netEngine = new NetChainEngine();
  netEngine.sample();
  // Wait a moment then sample again for delta
  await new Promise(r => setTimeout(r, 500));
  netEngine.sample();
  const netStatus = netEngine.status();

  if (verbose) {
    console.log("CURRENT NETWORK STATE");
    console.log("─".repeat(60));
    console.log(`  Download: ${fmt(netStatus.snapshot.rxMBps, 2)} MB/s`);
    console.log(`  Upload:   ${fmt(netStatus.snapshot.txMBps, 2)} MB/s`);
    console.log(`  IS ratio: ${fmt(netStatus.snapshot.isRatio * 100, 0)}% download / ${fmt((1 - netStatus.snapshot.isRatio) * 100, 0)}% upload`);
    console.log(`  Bridge:   ${fmt(netStatus.bridge.downloadShare * 100, 0)}% DL / ${fmt(netStatus.bridge.uploadShare * 100, 0)}% UL (sin²+cos²=${fmt(netStatus.bridge.downloadShare + netStatus.bridge.uploadShare, 4)})`);
    console.log(`  Chunk rec: level ${netStatus.chunkRec.level} (${netStatus.chunkRec.chunkBytes}B) — ${netStatus.chunkRec.reason}`);
    console.log();
  }

  // Run transfer tests
  if (verbose) {
    console.log("TRANSFER BENCHMARK (local TCP loopback)");
    console.log("─".repeat(60));
  }

  const results: TransferResult[] = [];

  // Fixed 1KB chunks (small, lots of overhead)
  results.push(await transferTest("Fixed 1KB", totalBytes, 1024));

  // Fixed 4KB chunks (standard)
  results.push(await transferTest("Fixed 4KB", totalBytes, 4096));

  // Fixed 16KB chunks (large)
  results.push(await transferTest("Fixed 16KB", totalBytes, 16384));

  // Fixed 64KB chunks (very large)
  results.push(await transferTest("Fixed 64KB", totalBytes, 65536));

  // Single TCP payload (1460)
  results.push(await transferTest("TCP MSS (1460B)", totalBytes, 1460));

  // h_info level 2 — pure (1352) and scheduled (1460)
  results.push(await transferTest(`h_info pure (${pureFib2}B)`, totalBytes, pureFib2));
  results.push(await transferTest(`h_info sched (${schedFib2}B)`, totalBytes, schedFib2));

  // Fibonacci ramp
  results.push(await fibTransferTest(totalBytes));

  if (verbose) {
    console.log();
    console.log(`  ${"Method".padEnd(28)} ${"Chunks".padStart(8)} ${"Size".padStart(8)} ${"Time ms".padStart(10)} ${"MB/s".padStart(10)} ${"Overhead".padStart(9)}`);
    console.log("  " + "─".repeat(73));
    for (const r of results) {
      const sizeStr = r.chunkSize < 1024 ? `${r.chunkSize}B` : `${fmt(r.chunkSize / 1024, 1)}KB`;
      console.log(
        `  ${r.label.padEnd(28)} ${String(r.chunkCount).padStart(8)} ${sizeStr.padStart(8)} ` +
        `${fmt(r.transferMs, 1).padStart(10)} ${fmt(r.throughputMBps, 1).padStart(10)} ` +
        `${fmt(r.overheadPct, 2).padStart(8)}%`
      );
    }
  }

  // Find winners
  const sorted = [...results].sort((a, b) => a.transferMs - b.transferMs);
  const fastest = sorted[0];
  const fibResult = results.find(r => r.label.includes("Fibonacci"));
  const mssResult = results.find(r => r.label.includes("MSS"));
  const pureResult = results.find(r => r.label.includes("pure"));
  const schedResult = results.find(r => r.label.includes("sched"));
  const fixed4k = results.find(r => r.label === "Fixed 4KB");

  if (verbose) {
    console.log();
    console.log("RESULTS");
    console.log("═".repeat(60));
    console.log(`  Fastest overall:     ${fastest.label} (${fmt(fastest.throughputMBps, 1)} MB/s)`);
    if (fibResult && fixed4k) {
      const speedup = fixed4k.transferMs / fibResult.transferMs;
      console.log(`  Fibonacci vs 4KB:    ${fmt(speedup, 2)}x ${speedup > 1 ? "faster" : "slower"}`);
    }
    if (schedResult && mssResult) {
      const diff = Math.abs(schedResult.transferMs - mssResult.transferMs);
      const pctDiff = (diff / mssResult.transferMs) * 100;
      console.log(`  h_info sched vs MSS: ${fmt(pctDiff, 1)}% difference (should be ≈0% — same size)`);
    }
    if (pureResult && mssResult) {
      const diff = Math.abs(pureResult.transferMs - mssResult.transferMs);
      const pctDiff = (diff / mssResult.transferMs) * 100;
      console.log(`  h_info pure vs MSS:  ${fmt(pctDiff, 1)}% difference (the 8% gap = missing schedule)`);
    }
    if (fibResult) {
      console.log(`  Fibonacci overhead:  ${fmt(fibResult.overheadPct, 2)}%`);
    }
    console.log();

    // Transfer plan example
    const plan = netEngine.planTransfer(50 * 1_048_576, "IS");
    console.log("EXAMPLE: 50MB DOWNLOAD PLAN (Fibonacci ramp)");
    console.log("─".repeat(60));
    for (const d of plan.distribution) {
      const sizeStr = d.bytes < 1024 ? `${d.bytes}B` : d.bytes < 1_048_576 ? `${fmt(d.bytes / 1024, 1)}KB` : `${fmt(d.bytes / 1_048_576, 2)}MB`;
      console.log(`  Level ${d.level}: ${d.count} chunks × ${H_INFO * FIB[d.level]}B = ${sizeStr}`);
    }
    console.log(`  Total: ${plan.chunkCount} chunks, est. ${fmt(plan.estimatedSeconds, 1)}s`);
    console.log(`  Direction: ${plan.direction === "IS" ? "→ download (IS path)" : "← upload (ISN'T path)"}`);
  }
}
