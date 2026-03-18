/**
 * NETWORK SAMPLER — Cross-platform network I/O monitoring
 *
 * Reads bytes sent/received from OS counters and computes
 * throughput, making the network visible to the derivative chain.
 *
 * Windows: netstat -e
 * Linux: /proc/net/dev
 */

import { execSync } from "child_process";
import * as fs from "fs";

export interface NetworkStats {
  /** Bytes received since boot (or last sample delta) */
  rxBytes: number;
  /** Bytes sent since boot (or last sample delta) */
  txBytes: number;
  /** Download rate in MB/s (computed from delta) */
  rxMBps: number;
  /** Upload rate in MB/s (computed from delta) */
  txMBps: number;
  /** Total throughput in MB/s */
  totalMBps: number;
  /** IS/ISN'T ratio: rx / (rx + tx). 1.0 = pure download, 0.0 = pure upload */
  isRatio: number;
}

// ── Internal state for delta computation ─────────────────────────────────

let _lastRx: number = 0;
let _lastTx: number = 0;
let _lastTime: number = 0;

// ── Platform implementations ─────────────────────────────────────────────

function sampleWindows(): { rx: number; tx: number } {
  try {
    const out = execSync("netstat -e", { timeout: 3000, encoding: "utf-8" });
    // Parse the "Bytes" row: "Bytes    <received>    <sent>"
    const match = out.match(/Bytes\s+(\d+)\s+(\d+)/);
    if (match) {
      return { rx: parseInt(match[1]), tx: parseInt(match[2]) };
    }
  } catch { /* fall through */ }
  return { rx: 0, tx: 0 };
}

function sampleLinux(): { rx: number; tx: number } {
  try {
    const data = fs.readFileSync("/proc/net/dev", "utf-8");
    const lines = data.split("\n");
    let totalRx = 0;
    let totalTx = 0;

    for (const line of lines) {
      // Skip header lines and loopback
      if (line.includes("|") || line.trim().startsWith("lo:")) continue;
      const match = line.match(/^\s*\w+:\s*(\d+)\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)/);
      if (match) {
        totalRx += parseInt(match[1]);
        totalTx += parseInt(match[2]);
      }
    }

    return { rx: totalRx, tx: totalTx };
  } catch { /* fall through */ }
  return { rx: 0, tx: 0 };
}

// ── Public API ───────────────────────────────────────────────────────────

export function getNetworkStats(): NetworkStats {
  const now = Date.now();
  const raw = process.platform === "win32" ? sampleWindows() : sampleLinux();

  let rxMBps = 0;
  let txMBps = 0;

  if (_lastTime > 0 && now > _lastTime) {
    const dtSec = (now - _lastTime) / 1000;
    const rxDelta = Math.max(0, raw.rx - _lastRx);
    const txDelta = Math.max(0, raw.tx - _lastTx);
    rxMBps = (rxDelta / 1_048_576) / dtSec;
    txMBps = (txDelta / 1_048_576) / dtSec;
  }

  _lastRx = raw.rx;
  _lastTx = raw.tx;
  _lastTime = now;

  const totalMBps = rxMBps + txMBps;
  const isRatio = totalMBps > 0 ? rxMBps / totalMBps : 0.5;

  return {
    rxBytes: raw.rx,
    txBytes: raw.tx,
    rxMBps,
    txMBps,
    totalMBps,
    isRatio,
  };
}
