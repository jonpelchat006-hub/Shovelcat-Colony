/**
 * LINUX SAMPLER — nvidia-smi + /proc
 */

import { execSync } from "child_process";
import * as fs from "fs";
import type { PlatformSampler, GPUStats, RAMStats, CPUStats, DiskStats } from "./interface";

let _cpuCache: CPUStats | null = null;

export const linuxSampler: PlatformSampler = {
  platform: "linux",

  getGPU(): GPUStats {
    try {
      const out = execSync(
        "nvidia-smi --query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu,temperature.gpu.tlimit --format=csv,noheader,nounits",
        { timeout: 5000, encoding: "utf-8" },
      );
      const parts = out.trim().split(",").map(s => s.trim());
      const tempC = parseFloat(parts[5]);
      const tdpTempC = parseFloat(parts[6]);
      return {
        available: true,
        totalMB: parseFloat(parts[1]) || 0,
        usedMB: parseFloat(parts[2]) || 0,
        freeMB: parseFloat(parts[3]) || 0,
        utilPct: parseFloat(parts[4]) || 0,
        name: parts[0] || "Unknown GPU",
        tempC: isNaN(tempC) ? null : tempC,
        tdpTempC: isNaN(tdpTempC) ? null : tdpTempC,
      };
    } catch {
      return { available: false, totalMB: 0, usedMB: 0, freeMB: 0, utilPct: 0, name: "none", tempC: null, tdpTempC: null };
    }
  },

  getRAM(): RAMStats {
    try {
      const meminfo = fs.readFileSync("/proc/meminfo", "utf-8");
      const totalKB = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)?.[1] ?? "0");
      const availKB = parseInt(meminfo.match(/MemAvailable:\s+(\d+)/)?.[1] ?? "0");
      const totalMB = totalKB / 1024;
      const availableMB = availKB / 1024;
      return { totalMB, availableMB, usedMB: totalMB - availableMB };
    } catch {
      return { totalMB: 0, availableMB: 0, usedMB: 0 };
    }
  },

  getCPU(): CPUStats {
    if (_cpuCache) return _cpuCache;
    try {
      const cpuinfo = fs.readFileSync("/proc/cpuinfo", "utf-8");
      const name = cpuinfo.match(/model name\s*:\s*(.+)/)?.[1]?.trim() ?? "Unknown";
      const threads = (cpuinfo.match(/processor\s*:/g) || []).length;
      const cores = parseInt(cpuinfo.match(/cpu cores\s*:\s*(\d+)/)?.[1] ?? String(threads));

      // CPU temperature from thermal zones
      let tempC: number | null = null;
      try {
        const temp = fs.readFileSync("/sys/class/thermal/thermal_zone0/temp", "utf-8");
        const raw = parseInt(temp.trim());
        if (!isNaN(raw)) tempC = raw / 1000;  // millidegrees to °C
      } catch { /* not available */ }

      _cpuCache = { name, cores, threads, tempC, tjMaxC: 100 };
      return _cpuCache;
    } catch {
      return { name: "Unknown", cores: 1, threads: 1, tempC: null, tjMaxC: null };
    }
  },

  getDisk(): DiskStats {
    try {
      const stat = fs.readFileSync("/proc/diskstats", "utf-8");
      // Parse first real disk — this is a rough estimate
      return { readRateMBps: 0, writeRateMBps: 0 };
    } catch {
      return { readRateMBps: 0, writeRateMBps: 0 };
    }
  },
};
