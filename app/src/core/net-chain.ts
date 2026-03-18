/**
 * NETWORK CHAIN — Fibonacci Transfer Chunking
 * =============================================
 *
 * Applies the derivative chain and quaternion structure to network I/O:
 *
 *   Disk (i, Euler)   = data to send/receive (committed, exists on disk)
 *   RAM (j, Snake)    = TCP window / socket buffer (volatile, in-flight)
 *   CPU (k, Bridge)   = protocol stack (TCP/IP, TLS, checksums)
 *   Network (w, Obs)  = the wire — data collapses into packets
 *
 * IS path (+)  = download (data arriving, filling buffers)
 * ISN'T path (-)  = upload (data leaving, draining buffers)
 * Void (0)    = available bandwidth
 *
 * KEY INSIGHT: h_info = 676 bytes. TCP payload = 1460 bytes.
 * Fibonacci level 2 = 1352 bytes ≈ one TCP payload.
 * The theory predicts optimal packet size from δ = π - 3.
 *
 * Fibonacci chunk sizing for transfers:
 *   Level 0: 676B    — control messages, handshakes
 *   Level 1: 676B    — ACKs, keepalives
 *   Level 2: 1352B   — single TCP payload (≈ MTU)
 *   Level 3: 2028B   — small request/response
 *   Level 4: 3380B   — medium (2-3 packets)
 *   Level 5: 5408B   — standard chunk (API responses)
 *   Level 6: 8788B   — large chunk (images, small files)
 *   Level 7: 14196B  — max chunk (streaming, bulk transfer)
 *
 * Adaptive: the engine watches throughput derivatives and shifts
 * chunk level up/down based on congestion signals.
 *
 * Author: Jonathan Pelchat
 * Shovelcat Theory — Network Chain
 */

import { getNetworkStats, type NetworkStats } from "./sampler/network";

// ── Constants ────────────────────────────────────────────────────────────

const DELTA = Math.PI - 3;                    // ≈ 0.14159
const BASE_BLOCK = 4096;
const H_INFO = Math.round(BASE_BLOCK * DELTA / (1 - DELTA));  // 676 bytes
const FIB = [1, 1, 2, 3, 5, 8, 13, 21];
const TCP_MSS = 1460;                         // max segment size (typical)

// ── Types ────────────────────────────────────────────────────────────────

export interface NetChainSnapshot {
  timestamp: number;
  rxMBps: number;
  txMBps: number;
  totalMBps: number;
  isRatio: number;      // 1.0 = pure download, 0.0 = pure upload
  rxVelocity: number;   // rate of change of download speed
  txVelocity: number;   // rate of change of upload speed
}

export interface ChunkRecommendation {
  /** Recommended Fibonacci level (0-7) */
  level: number;
  /** Chunk size in bytes */
  chunkBytes: number;
  /** How many TCP packets this spans */
  tcpPackets: number;
  /** Reason for this level */
  reason: string;
  /** Confidence in recommendation (0-1) */
  confidence: number;
}

export interface TransferPlan {
  /** Total file size in bytes */
  totalBytes: number;
  /** Recommended chunk level */
  chunkLevel: number;
  /** Chunk size in bytes */
  chunkBytes: number;
  /** Number of chunks */
  chunkCount: number;
  /** Estimated transfer time in seconds */
  estimatedSeconds: number;
  /** Fibonacci distribution: how many chunks at each level */
  distribution: Array<{ level: number; count: number; bytes: number }>;
  /** IS path (download) or ISN'T path (upload) */
  direction: "IS" | "ISNT";
}

export interface NetChainStatus {
  snapshot: NetChainSnapshot;
  chunkRec: ChunkRecommendation;
  bridge: {
    /** sin²θ for download share, cos²θ for upload share */
    downloadShare: number;
    uploadShare: number;
    /** Available bandwidth (void) estimate in MB/s */
    voidMBps: number;
    /** Congestion detected */
    congested: boolean;
  };
  /** How h_info relates to TCP */
  theory: {
    hInfo: number;
    tcpMSS: number;
    fibLevel2: number;
    mssToFibRatio: number;   // TCP_MSS / fib_level_2 — should be ≈ 1.08
    deltaFromMSS: number;    // |1 - ratio| — how close theory matches reality
  };
}

// ── Network Chain Engine ─────────────────────────────────────────────────

export class NetChainEngine {
  private history: NetChainSnapshot[] = [];
  private maxHistory: number;

  constructor(maxHistory: number = 60) {
    this.maxHistory = maxHistory;
  }

  /** Take a network sample */
  sample(): NetChainSnapshot {
    const stats = getNetworkStats();

    // Compute velocity from previous samples
    let rxVelocity = 0;
    let txVelocity = 0;

    if (this.history.length > 0) {
      const prev = this.history[this.history.length - 1];
      const dt = (Date.now() - prev.timestamp) / 1000;
      if (dt > 0) {
        rxVelocity = (stats.rxMBps - prev.rxMBps) / dt;
        txVelocity = (stats.txMBps - prev.txMBps) / dt;
      }
    }

    const snapshot: NetChainSnapshot = {
      timestamp: Date.now(),
      rxMBps: stats.rxMBps,
      txMBps: stats.txMBps,
      totalMBps: stats.totalMBps,
      isRatio: stats.isRatio,
      rxVelocity,
      txVelocity,
    };

    this.history.push(snapshot);
    if (this.history.length > this.maxHistory) this.history.shift();

    return snapshot;
  }

  /**
   * Recommend optimal chunk level based on current network state.
   *
   * The logic:
   *   - Low throughput or high congestion → smaller chunks (more adaptive)
   *   - High throughput, stable → larger chunks (fewer overhead packets)
   *   - Velocity negative (slowing down) → step down a level (congestion coming)
   *   - Velocity positive (speeding up) → step up (bandwidth available)
   *
   * This mirrors TCP congestion control but uses Fibonacci levels
   * instead of arbitrary window doubling.
   */
  recommendChunk(): ChunkRecommendation {
    const n = this.history.length;
    if (n === 0) {
      return {
        level: 2,
        chunkBytes: H_INFO * FIB[2],
        tcpPackets: 1,
        reason: "default — no data yet (1 TCP payload)",
        confidence: 0.1,
      };
    }

    const curr = this.history[n - 1];
    const throughput = curr.totalMBps;
    const velocity = curr.rxVelocity + curr.txVelocity;

    // Base level from throughput
    let level: number;
    if (throughput < 0.01) {
      level = 0;  // almost no traffic — minimal chunks
    } else if (throughput < 0.1) {
      level = 2;  // low — single TCP payload
    } else if (throughput < 1) {
      level = 3;  // moderate — 2KB chunks
    } else if (throughput < 10) {
      level = 5;  // good — 5KB chunks
    } else if (throughput < 50) {
      level = 6;  // fast — 8KB chunks
    } else {
      level = 7;  // very fast — max chunks
    }

    // Adjust for velocity (congestion signal)
    if (velocity < -0.5 && level > 1) {
      level--;  // slowing down → smaller chunks, more adaptive
    } else if (velocity > 0.5 && level < 7) {
      level++;  // speeding up → larger chunks, less overhead
    }

    // Stability bonus: if throughput has been steady, go bigger
    if (n >= 5) {
      const recent = this.history.slice(-5);
      const avgThroughput = recent.reduce((s, h) => s + h.totalMBps, 0) / 5;
      const variance = recent.reduce((s, h) => s + Math.pow(h.totalMBps - avgThroughput, 2), 0) / 5;
      if (variance < 0.01 * avgThroughput && level < 7) {
        level++;  // very stable — safe to go bigger
      }
    }

    level = Math.max(0, Math.min(7, level));
    const chunkBytes = H_INFO * FIB[level];
    const tcpPackets = Math.ceil(chunkBytes / TCP_MSS);
    const confidence = Math.min(1, n / 10);

    let reason: string;
    if (velocity < -0.5) {
      reason = `congestion signal (vel=${velocity.toFixed(2)}) → stepped down`;
    } else if (velocity > 0.5) {
      reason = `bandwidth growing (vel=${velocity.toFixed(2)}) → stepped up`;
    } else if (throughput < 0.01) {
      reason = "idle network — minimal chunks";
    } else {
      reason = `${throughput.toFixed(1)} MB/s throughput → ${tcpPackets} TCP packet${tcpPackets > 1 ? "s" : ""}`;
    }

    return { level, chunkBytes, tcpPackets, reason, confidence };
  }

  /**
   * Plan a file transfer using Fibonacci chunk distribution.
   *
   * Instead of uniform chunks, distributes the file across Fibonacci levels:
   *   - Start at level 2 (single TCP payload) — probe the connection
   *   - Ramp up through levels following golden ratio
   *   - Peak at recommended level
   *   - Taper back down for final chunks
   *
   * This creates a natural slow-start → cruise → graceful-finish pattern
   * that matches how bandwidth actually behaves.
   */
  planTransfer(totalBytes: number, direction: "IS" | "ISNT" = "IS"): TransferPlan {
    const rec = this.recommendChunk();
    const peakLevel = rec.level;

    // Build ramp-up / cruise / ramp-down distribution
    const distribution: Array<{ level: number; count: number; bytes: number }> = [];
    let remaining = totalBytes;

    // Ensure peak is at least level 5 for transfers (level 0 is for control msgs only)
    const effectivePeak = Math.max(5, peakLevel);

    // Phase 1: Ramp up (levels 2 → effectivePeak)
    for (let l = 2; l <= effectivePeak && remaining > 0; l++) {
      const chunkSize = H_INFO * FIB[l];
      // Fibonacci number of chunks at this ramp level
      const rampChunks = Math.min(FIB[l], Math.ceil(remaining / chunkSize));
      const bytes = rampChunks * chunkSize;
      distribution.push({ level: l, count: rampChunks, bytes: Math.min(bytes, remaining) });
      remaining -= bytes;
    }

    // Phase 2: Cruise at peak level
    if (remaining > 0) {
      const chunkSize = H_INFO * FIB[effectivePeak];
      const cruiseChunks = Math.floor(remaining / chunkSize);
      if (cruiseChunks > 0) {
        const bytes = cruiseChunks * chunkSize;
        distribution.push({ level: effectivePeak, count: cruiseChunks, bytes });
        remaining -= bytes;
      }
    }

    // Phase 3: Ramp down with remainder
    if (remaining > 0) {
      // Find best fitting Fibonacci level for remainder
      let bestLevel = 0;
      for (let l = 7; l >= 0; l--) {
        if (H_INFO * FIB[l] <= remaining) {
          bestLevel = l;
          break;
        }
      }
      distribution.push({ level: bestLevel, count: 1, bytes: remaining });
    }

    const totalChunks = distribution.reduce((s, d) => s + d.count, 0);
    const curr = this.history.length > 0 ? this.history[this.history.length - 1] : null;
    const throughputMBps = curr
      ? (direction === "IS" ? curr.rxMBps : curr.txMBps)
      : 1;  // assume 1 MB/s if no data
    const estimatedSeconds = throughputMBps > 0
      ? (totalBytes / 1_048_576) / throughputMBps
      : totalBytes / 1_048_576;  // assume 1 MB/s

    return {
      totalBytes,
      chunkLevel: effectivePeak,
      chunkBytes: H_INFO * FIB[effectivePeak],
      chunkCount: totalChunks,
      estimatedSeconds,
      distribution,
      direction,
    };
  }

  /** Get full network chain status */
  status(): NetChainStatus {
    const snapshot = this.history.length > 0
      ? this.history[this.history.length - 1]
      : { timestamp: Date.now(), rxMBps: 0, txMBps: 0, totalMBps: 0, isRatio: 0.5, rxVelocity: 0, txVelocity: 0 };

    const chunkRec = this.recommendChunk();

    // Bridge: download/upload share using trig identity
    const theta = (1 - snapshot.isRatio) * (Math.PI / 2);
    const downloadShare = Math.pow(Math.cos(theta), 2);
    const uploadShare = Math.pow(Math.sin(theta), 2);

    // Void: estimate available bandwidth
    // If we're using less than historical peak, the difference is void
    const peakThroughput = this.history.reduce((max, h) => Math.max(max, h.totalMBps), 0.001);
    const voidMBps = Math.max(0, peakThroughput - snapshot.totalMBps);

    // Congestion: throughput dropping while demand exists
    const congested = snapshot.rxVelocity < -1 || snapshot.txVelocity < -1;

    // Theory validation
    const fibLevel2 = H_INFO * FIB[2];
    const mssToFibRatio = TCP_MSS / fibLevel2;
    const deltaFromMSS = Math.abs(1 - mssToFibRatio);

    return {
      snapshot,
      chunkRec,
      bridge: { downloadShare, uploadShare, voidMBps, congested },
      theory: {
        hInfo: H_INFO,
        tcpMSS: TCP_MSS,
        fibLevel2,
        mssToFibRatio,
        deltaFromMSS,
      },
    };
  }
}
