/**
 * Platform-specific sampler factory.
 */

import type { PlatformSampler } from "./interface";

export type { PlatformSampler, GPUStats, RAMStats, CPUStats, DiskStats } from "./interface";
export { getNetworkStats, type NetworkStats } from "./network";

export function getSampler(): PlatformSampler {
  switch (process.platform) {
    case "win32": {
      const { windowsSampler } = require("./windows");
      return windowsSampler;
    }
    case "linux": {
      const { linuxSampler } = require("./linux");
      return linuxSampler;
    }
    default:
      // Fallback: return a sampler that reports zeros
      return {
        platform: process.platform,
        getGPU: () => ({ available: false, totalMB: 0, usedMB: 0, freeMB: 0, utilPct: 0, name: "none", tempC: null, tdpTempC: null }),
        getRAM: () => ({ totalMB: 0, availableMB: 0, usedMB: 0 }),
        getCPU: () => ({ name: "Unknown", cores: 1, threads: 1, tempC: null, tjMaxC: null }),
        getDisk: () => ({ readRateMBps: 0, writeRateMBps: 0 }),
      };
  }
}
