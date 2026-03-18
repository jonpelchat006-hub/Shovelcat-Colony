/**
 * PLATFORM SAMPLER INTERFACE
 *
 * Abstracts hardware monitoring across Windows/Linux/macOS.
 * Each tier of the derivative chain has a sampler:
 *
 *   Tier 0: Disk    = field (x)
 *   Tier 1: RAM     = velocity (dx/dt)
 *   Tier 2: CPU     = acceleration (d²x/dt²)
 *   Tier 3: VRAM    = observer (collapse)
 */

export interface GPUStats {
  available: boolean;
  totalMB: number;
  usedMB: number;
  freeMB: number;
  utilPct: number;
  name: string;
  /** GPU temperature in °C (null if unavailable) */
  tempC: number | null;
  /** TDP / max rated temperature in °C (from spec, null if unknown) */
  tdpTempC: number | null;
}

export interface RAMStats {
  totalMB: number;
  availableMB: number;
  usedMB: number;
}

export interface CPUStats {
  cores: number;
  threads: number;
  name: string;
  /** CPU temperature in °C (null if unavailable) */
  tempC: number | null;
  /** TJunction / max rated temperature in °C (from spec, null if unknown) */
  tjMaxC: number | null;
}

export interface DiskStats {
  /** Estimated read rate in MB/s (from OS counters or delta) */
  readRateMBps: number;
  /** Estimated write rate in MB/s */
  writeRateMBps: number;
}

export interface PlatformSampler {
  getGPU(): GPUStats;
  getRAM(): RAMStats;
  getCPU(): CPUStats;
  getDisk(): DiskStats;
  platform: string;
}
