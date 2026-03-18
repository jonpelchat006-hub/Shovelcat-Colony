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
        "nvidia-smi --query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu,temperature.gpu.tlimit --format=csv,noheader,nounits",
        { timeout: 5000, encoding: "utf-8" },
      );
      const parts = out.trim().split(",").map(s => s.trim());
      const total = parseFloat(parts[1]) || 0;
      const used = parseFloat(parts[2]) || 0;
      const free = parseFloat(parts[3]) || 0;
      const util = parseFloat(parts[4]) || 0;
      const tempC = parseFloat(parts[5]);
      const tdpTempC = parseFloat(parts[6]);
      return {
        available: true,
        totalMB: total,
        usedMB: used,
        freeMB: free,
        utilPct: util,
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

      // CPU temperature via WMI thermal zone (requires admin on some systems)
      let tempC: number | null = null;
      try {
        const tempOut = execSync(
          'powershell -Command "Get-CimInstance MSAcpi_ThermalZoneTemperature -Namespace root/wmi 2>$null | Select -First 1 -ExpandProperty CurrentTemperature"',
          { timeout: 5000, encoding: "utf-8" },
        );
        const raw = parseInt(tempOut.trim());
        if (!isNaN(raw) && raw > 0) {
          tempC = (raw / 10) - 273.15;  // WMI reports in tenths of Kelvin
        }
      } catch {
        // Not available without admin — will use null
      }

      // TjMax: most modern Intel/AMD CPUs have TjMax of 100°C
      // Could query via specific tools, but 100°C is a safe default
      const tjMaxC = 100;

      _cpuCache = { name, cores, threads, tempC, tjMaxC };
      return _cpuCache;
    } catch {
      return { name: "Unknown", cores: 1, threads: 1, tempC: null, tjMaxC: null };
    }
  },

  getDisk(): DiskStats {
    // Windows doesn't have easy disk I/O rate via wmic without perf counters
    // Return 0 — the derivative chain infers disk rate from RAM bandwidth changes
    return { readRateMBps: 0, writeRateMBps: 0 };
  },
};
