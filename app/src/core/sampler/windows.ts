/**
 * WINDOWS SAMPLER — nvidia-smi + wmic
 */

import { execSync } from "child_process";
import type { PlatformSampler, GPUStats, RAMStats, CPUStats, DiskStats } from "./interface";

let _cpuCache: CPUStats | null = null;

export const windowsSampler: PlatformSampler = {
  platform: "win32",

  getGPU(): GPUStats {
    try {
      const out = execSync(
        "nvidia-smi --query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu --format=csv,noheader,nounits",
        { timeout: 5000, encoding: "utf-8" },
      );
      const parts = out.trim().split(",").map(s => s.trim());
      const total = parseFloat(parts[1]) || 0;
      const used = parseFloat(parts[2]) || 0;
      const free = parseFloat(parts[3]) || 0;
      const util = parseFloat(parts[4]) || 0;
      return {
        available: true,
        totalMB: total,
        usedMB: used,
        freeMB: free,
        utilPct: util,
        name: parts[0] || "Unknown GPU",
      };
    } catch {
      return { available: false, totalMB: 0, usedMB: 0, freeMB: 0, utilPct: 0, name: "none" };
    }
  },

  getRAM(): RAMStats {
    try {
      const out = execSync(
        "wmic OS get TotalVisibleMemorySize,FreePhysicalMemory /format:list",
        { timeout: 5000, encoding: "utf-8" },
      );
      const totalKB = parseInt(out.match(/TotalVisibleMemorySize=(\d+)/)?.[1] ?? "0");
      const freeKB = parseInt(out.match(/FreePhysicalMemory=(\d+)/)?.[1] ?? "0");
      const totalMB = totalKB / 1024;
      const availableMB = freeKB / 1024;
      return { totalMB, availableMB, usedMB: totalMB - availableMB };
    } catch {
      return { totalMB: 0, availableMB: 0, usedMB: 0 };
    }
  },

  getCPU(): CPUStats {
    if (_cpuCache) return _cpuCache;
    try {
      const out = execSync(
        "wmic cpu get Name,NumberOfCores,NumberOfLogicalProcessors /format:list",
        { timeout: 5000, encoding: "utf-8" },
      );
      const name = out.match(/Name=(.+)/)?.[1]?.trim() ?? "Unknown CPU";
      const cores = parseInt(out.match(/NumberOfCores=(\d+)/)?.[1] ?? "1");
      const threads = parseInt(out.match(/NumberOfLogicalProcessors=(\d+)/)?.[1] ?? "1");
      _cpuCache = { name, cores, threads };
      return _cpuCache;
    } catch {
      return { name: "Unknown", cores: 1, threads: 1 };
    }
  },

  getDisk(): DiskStats {
    // Windows doesn't have easy disk I/O rate via wmic without perf counters
    // Return 0 — the derivative chain infers disk rate from RAM bandwidth changes
    return { readRateMBps: 0, writeRateMBps: 0 };
  },
};
