/**
 * DRIVE MAP — Physical Disk to Spiral Zone Mapping
 * =================================================
 *
 * Maps a real drive (D:\) onto the golden spiral addressing system.
 * The drive becomes 8 Fibonacci zones (L0-L7), each a real directory,
 * with data placed according to temperature (access frequency).
 *
 * ZONE ALLOCATION (931GB example, φ-weighted):
 *
 *   The Fibonacci sequence weights zone sizes:
 *     FIB = [1, 1, 2, 3, 5, 8, 13, 21]  sum = 54
 *
 *   Zone  Fib  Share    Size (931GB)  Purpose
 *   L0    1    1.9%     17GB          Hot config, indices, system tables
 *   L1    1    1.9%     17GB          Metadata, tokenizers, shaders
 *   L2    2    3.7%     34GB          Audio, frequently accessed data
 *   L3    3    5.6%     52GB          Textures, embeddings
 *   L4    5    9.3%     86GB          Models, large datasets (spacetime boundary)
 *   L5    8    14.8%    138GB         ── COLLAPSED ── Facts (binary verify)
 *   L6    13   24.1%    224GB         ── COLLAPSED ── Memory (prime backbone)
 *   L7    21   38.9%    362GB         ── COLLAPSED ── Imagination (full spectrum)
 *
 * Classical zones (L0-L4): ~206GB — deterministic storage, fast access
 * Collapsed zones (L5-L7): ~724GB — tensor overlay, hex VM mesh, branch-aware
 *
 * The derivative chain daemon manages placement. New data enters at L7
 * (imagination — full possibility space) and migrates inward as it's
 * verified (L6 memory → L5 facts → L4 classical storage).
 *
 * HOW IT ATTACHES TO C:
 *
 *   Option 1: Junction points (NTFS) — D:\L0 appears as C:\shovelcat\hot
 *   Option 2: API bridge — C: apps query D: through the branch resolution API
 *   Option 3: Symlink farm — individual data files linked from C: to D: zones
 *
 *   The daemon on D: exposes an HTTP API (same as the existing radio/SSE system).
 *   C: apps (Shovelcat-AI, games, tools) call the API to read/write data.
 *   The API resolves through the tensor field — same data, different branch.
 *
 * Author: Jonathan Pelchat
 * Shovelcat Theory — The Spiral Drive OS
 */

import * as fs from "fs";
import * as path from "path";
import { PHI, DELTA } from "./quaternion-chain";

// ── Constants ────────────────────────────────────────────────────────────

const FIB = [1, 1, 2, 3, 5, 8, 13, 21];
const FIB_SUM = FIB.reduce((a, b) => a + b, 0);  // 54

/** Zone names for directory structure */
const ZONE_NAMES = [
  "L0-origin",        // hot config, indices
  "L1-time",          // metadata, tokenizers
  "L2-plane",         // audio, frequent data
  "L3-space",         // textures, embeddings
  "L4-spacetime",     // models, large datasets (classical boundary)
  "L5-facts",         // ── collapsed ── binary verification
  "L6-memory",        // ── collapsed ── prime backbone
  "L7-imagination",   // ── collapsed ── full spectrum
];

const ZONE_DESCRIPTIONS = [
  "Hot config, system indices, lookup tables",
  "Metadata, tokenizers, shaders, headers",
  "Audio, frequently accessed assets, P-frames",
  "Textures, embeddings, B-frames",
  "Models, large datasets, I-frames (classical boundary)",
  "Facts VMs — binary verification, IS/ISN'T collapse",
  "Memory VMs — prime backbone, pattern matching, vesica bridge",
  "Imagination VMs — full spectrum projection, color paths",
];

// ── Drive Info ────────────────────────────────────────────────────────────

export interface DriveInfo {
  /** Drive letter or mount point */
  mount: string;
  /** Total size in bytes */
  totalBytes: number;
  /** Free space in bytes */
  freeBytes: number;
  /** Used space in bytes */
  usedBytes: number;
  /** Filesystem type */
  fsType: string;
}

/** Get drive info for a given path */
export function getDriveInfo(drivePath: string): DriveInfo {
  // Use statfsSync if available (Node 18.15+), otherwise estimate
  try {
    const stats = fs.statfsSync(drivePath);
    return {
      mount: drivePath,
      totalBytes: stats.bsize * stats.blocks,
      freeBytes: stats.bsize * stats.bavail,
      usedBytes: stats.bsize * (stats.blocks - stats.bavail),
      fsType: "NTFS",  // Assume NTFS on Windows
    };
  } catch {
    // Fallback: try to read from the OS
    return {
      mount: drivePath,
      totalBytes: 0,
      freeBytes: 0,
      usedBytes: 0,
      fsType: "unknown",
    };
  }
}

// ── Zone Allocation ──────────────────────────────────────────────────────

export interface ZoneAllocation {
  /** Zone level (0-7) */
  level: number;
  /** Directory name */
  dirName: string;
  /** Full path on disk */
  dirPath: string;
  /** Description */
  description: string;
  /** Fibonacci weight */
  fibWeight: number;
  /** Share of total drive (0-1) */
  share: number;
  /** Allocated bytes */
  allocatedBytes: number;
  /** Is this a collapsed zone? (L5-L7) */
  collapsed: boolean;
  /** Tensor axis (only for collapsed zones) */
  tensorAxis?: "facts" | "memory" | "imagination";
}

export interface DriveMap {
  /** The physical drive */
  drive: DriveInfo;
  /** Zone allocations */
  zones: ZoneAllocation[];
  /** Total classical space (L0-L4) */
  classicalBytes: number;
  /** Total collapsed space (L5-L7) */
  collapsedBytes: number;
  /** Colony overhead (daemon, config, logs) */
  colonyBytes: number;
  /** Root path for the spiral drive */
  rootPath: string;
}

/**
 * Compute zone allocations for a drive.
 *
 * The drive is split into 8 Fibonacci-weighted zones.
 * A small colony overhead (~1% or 100MB minimum) is reserved
 * for the daemon, config, logs, and metrics.
 */
export function computeDriveMap(
  drivePath: string,
  options: {
    /** Override total bytes (for testing) */
    totalBytes?: number;
    /** Colony overhead fraction (default 0.01 = 1%) */
    colonyOverhead?: number;
  } = {},
): DriveMap {
  const drive = getDriveInfo(drivePath);
  const totalBytes = options.totalBytes ?? drive.totalBytes;
  const colonyFrac = options.colonyOverhead ?? 0.01;

  // Reserve colony overhead (minimum 100MB)
  const colonyBytes = Math.max(100 * 1024 * 1024, Math.floor(totalBytes * colonyFrac));
  const usableBytes = totalBytes - colonyBytes;

  const rootPath = path.join(drivePath, "shovelcat-colony");
  const zonesDir = path.join(rootPath, "zones");

  const tensorAxes: Record<number, "facts" | "memory" | "imagination"> = {
    5: "facts",
    6: "memory",
    7: "imagination",
  };

  const zones: ZoneAllocation[] = FIB.map((fib, i) => {
    const share = fib / FIB_SUM;
    const allocatedBytes = Math.floor(usableBytes * share);
    const collapsed = i >= 5;

    return {
      level: i,
      dirName: ZONE_NAMES[i],
      dirPath: path.join(zonesDir, ZONE_NAMES[i]),
      description: ZONE_DESCRIPTIONS[i],
      fibWeight: fib,
      share,
      allocatedBytes,
      collapsed,
      tensorAxis: tensorAxes[i],
    };
  });

  const classicalBytes = zones.filter(z => !z.collapsed).reduce((s, z) => s + z.allocatedBytes, 0);
  const collapsedBytes = zones.filter(z => z.collapsed).reduce((s, z) => s + z.allocatedBytes, 0);

  return {
    drive,
    zones,
    classicalBytes,
    collapsedBytes,
    colonyBytes,
    rootPath,
  };
}

// ── Directory Structure ──────────────────────────────────────────────────

/**
 * Create the physical directory structure for the spiral drive.
 *
 * This creates:
 *   D:\shovelcat-colony\zones\L0-origin\
 *   D:\shovelcat-colony\zones\L1-time\
 *   ...
 *   D:\shovelcat-colony\zones\L7-imagination\
 *   D:\shovelcat-colony\zones\L5-facts\hex\        ← hex VM cells
 *   D:\shovelcat-colony\zones\L6-memory\hex\       ← hex VM cells
 *   D:\shovelcat-colony\zones\L7-imagination\hex\   ← hex VM cells
 *   D:\shovelcat-colony\colony\                      ← daemon state
 *   D:\shovelcat-colony\bridge\                      ← C: attachment point
 */
export function createDriveStructure(map: DriveMap): { created: string[]; existed: string[] } {
  const created: string[] = [];
  const existed: string[] = [];

  function ensure(dir: string): void {
    if (fs.existsSync(dir)) {
      existed.push(dir);
    } else {
      fs.mkdirSync(dir, { recursive: true });
      created.push(dir);
    }
  }

  // Root
  ensure(map.rootPath);

  // Zones directory
  const zonesDir = path.join(map.rootPath, "zones");
  ensure(zonesDir);

  // Each zone
  for (const zone of map.zones) {
    ensure(zone.dirPath);

    // Collapsed zones get hex VM subdirectories
    if (zone.collapsed) {
      ensure(path.join(zone.dirPath, "hex"));
      ensure(path.join(zone.dirPath, "input"));
      ensure(path.join(zone.dirPath, "output"));
    }

    // All zones get an index and data directory
    ensure(path.join(zone.dirPath, "data"));
  }

  // Colony overhead directories
  ensure(path.join(map.rootPath, "colony"));
  ensure(path.join(map.rootPath, "colony", "daemon"));
  ensure(path.join(map.rootPath, "colony", "metrics"));
  ensure(path.join(map.rootPath, "colony", "logs"));

  // Bridge — the attachment point for C: drive
  ensure(path.join(map.rootPath, "bridge"));
  ensure(path.join(map.rootPath, "bridge", "ai"));         // facts axis
  ensure(path.join(map.rootPath, "bridge", "club"));       // imagination axis
  ensure(path.join(map.rootPath, "bridge", "alpha"));      // memory axis

  // Feedback loop directory
  ensure(path.join(map.rootPath, "feedback"));

  return { created, existed };
}

/**
 * Write the zone manifest — a JSON file describing the drive layout.
 * This is what C: reads to understand D:'s structure.
 */
export function writeManifest(map: DriveMap): string {
  const manifestPath = path.join(map.rootPath, "spiral-manifest.json");

  const manifest = {
    version: "1.0.0",
    created: new Date().toISOString(),
    drive: {
      mount: map.drive.mount,
      totalGB: +(map.drive.totalBytes / 1024 / 1024 / 1024).toFixed(2),
      freeGB: +(map.drive.freeBytes / 1024 / 1024 / 1024).toFixed(2),
      fsType: map.drive.fsType,
    },
    zones: map.zones.map(z => ({
      level: z.level,
      name: z.dirName,
      description: z.description,
      allocatedGB: +(z.allocatedBytes / 1024 / 1024 / 1024).toFixed(2),
      share: +(z.share * 100).toFixed(1),
      collapsed: z.collapsed,
      tensorAxis: z.tensorAxis ?? null,
    })),
    summary: {
      classicalGB: +(map.classicalBytes / 1024 / 1024 / 1024).toFixed(2),
      collapsedGB: +(map.collapsedBytes / 1024 / 1024 / 1024).toFixed(2),
      colonyGB: +(map.colonyBytes / 1024 / 1024 / 1024).toFixed(2),
    },
    bridge: {
      path: path.join(map.rootPath, "bridge"),
      branches: ["ai", "club", "alpha"],
      protocol: "file",  // future: http, grpc
    },
    constants: {
      phi: PHI,
      delta: DELTA,
      goldenAngleDeg: 137.5077640500378,
      colonyShare: 1 / (1 + PHI),
      fibSequence: FIB,
    },
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return manifestPath;
}

// ── Print Drive Map ──────────────────────────────────────────────────────

function fmtBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(1) + "GB";
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + "MB";
  return (bytes / 1024).toFixed(1) + "KB";
}

export function printDriveMap(map: DriveMap): void {
  const fmt = (n: number, d: number = 1) => n.toFixed(d);

  console.log("SPIRAL DRIVE MAP — Physical Disk to Fibonacci Zones");
  console.log("═".repeat(70));
  console.log(`  Drive: ${map.drive.mount}`);
  console.log(`  Total: ${fmtBytes(map.drive.totalBytes)} | Free: ${fmtBytes(map.drive.freeBytes)} | FS: ${map.drive.fsType}`);
  console.log(`  Root:  ${map.rootPath}`);
  console.log();

  // Zone table
  console.log("  FIBONACCI ZONE ALLOCATION:");
  console.log("  " + "─".repeat(66));
  console.log(`  ${"Zone".padEnd(18)} ${"Fib".padStart(4)} ${"Share".padStart(6)} ${"Size".padStart(8)} ${"Type".padEnd(12)} ${"Tensor Axis"}`);
  console.log("  " + "─".repeat(66));

  for (const z of map.zones) {
    const type = z.collapsed ? "COLLAPSED" : "classical";
    const axis = z.tensorAxis ?? "—";
    console.log(
      `  ${z.dirName.padEnd(18)} ${String(z.fibWeight).padStart(4)} ` +
      `${fmt(z.share * 100, 1).padStart(5)}% ` +
      `${fmtBytes(z.allocatedBytes).padStart(8)} ` +
      `${type.padEnd(12)} ${axis}`
    );
  }

  console.log("  " + "─".repeat(66));
  console.log(`  ${"Classical (L0-L4):".padEnd(30)} ${fmtBytes(map.classicalBytes).padStart(8)}`);
  console.log(`  ${"Collapsed (L5-L7):".padEnd(30)} ${fmtBytes(map.collapsedBytes).padStart(8)}`);
  console.log(`  ${"Colony overhead:".padEnd(30)} ${fmtBytes(map.colonyBytes).padStart(8)}`);
  console.log();

  // Bridge info
  console.log("  C: BRIDGE (how C: drive connects):");
  console.log(`    ${map.rootPath}\\bridge\\ai\\     → facts axis (what IS)`);
  console.log(`    ${map.rootPath}\\bridge\\club\\   → imagination axis (what COULD BE)`);
  console.log(`    ${map.rootPath}\\bridge\\alpha\\  → memory axis (how it FELT)`);
  console.log();
  console.log(`    Apps on C: read/write through the bridge directory.`);
  console.log(`    The daemon resolves which zone and hex cell to access.`);
  console.log(`    Same file, different branch = different tensor perspective.`);
  console.log();

  // Architecture summary
  const classicalPct = map.classicalBytes / (map.classicalBytes + map.collapsedBytes) * 100;
  const collapsedPct = map.collapsedBytes / (map.classicalBytes + map.collapsedBytes) * 100;
  console.log("  ARCHITECTURE:");
  console.log(`    Classical : Collapsed = ${fmt(classicalPct, 0)}% : ${fmt(collapsedPct, 0)}%`);
  console.log(`    This follows the open:collapsed dimension ratio (5:3)`);
  console.log(`    L0-L4 = deterministic storage (verified, fast, no seams)`);
  console.log(`    L5-L7 = tensor compute space (hex VMs, pressure field, branch-aware)`);
  console.log(`    Data migrates inward: L7 (new) → L6 (contextual) → L5 (verified) → L4 (classical)`);
  console.log();
}
