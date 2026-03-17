/**
 * .GEO SPORE FILE FORMAT
 * ======================
 *
 * A .geo file is a self-describing spore — a tiny binary+JSON envelope
 * that carries configuration, identity, and state for the derivative chain.
 *
 * Format (v1):
 *   [4 bytes]  magic   = "GEO\x01"
 *   [4 bytes]  version = uint32 LE (1)
 *   [4 bytes]  flags   = uint32 LE (bitfield)
 *   [4 bytes]  length  = uint32 LE (JSON payload length)
 *   [N bytes]  payload = JSON (GeoPayload)
 *
 * Flags:
 *   bit 0: dormant (spore is sleeping)
 *   bit 1: has_ai (tier 2 guide is active)
 *   bit 2: has_colony (tier 3 bridge is active)
 *   bit 3: encrypted (payload is AES-256-GCM)
 *
 * The .geo file lives next to the app or in a user-chosen directory.
 * It persists across reboots and carries the spore's learned state.
 */

import * as fs from "fs";
import * as path from "path";

// ── Constants ──────────────────────────────────────────────────────────

const MAGIC = Buffer.from([0x47, 0x45, 0x4F, 0x01]); // "GEO\x01"
const VERSION = 1;
const HEADER_SIZE = 16; // 4+4+4+4

// ── Flag bits ──────────────────────────────────────────────────────────

export const GEO_FLAG = {
  DORMANT:    0b0001,
  HAS_AI:     0b0010,
  HAS_COLONY: 0b0100,
  ENCRYPTED:  0b1000,
} as const;

// ── Types ──────────────────────────────────────────────────────────────

export interface GeoIdentity {
  /** Unique spore ID (generated on first boot) */
  id: string;
  /** Human-readable name */
  name: string;
  /** When this spore was born */
  createdAt: string;
  /** Host machine fingerprint (hashed) */
  hostHash: string;
}

export interface GeoConfig {
  /** Resource ceiling — max fraction of system resources (0.1–0.9) */
  userCeiling: number;
  /** Sampling interval in milliseconds */
  sampleIntervalMs: number;
  /** Max history entries to keep in memory */
  maxHistory: number;
  /** Whether to run as a background daemon */
  daemon: boolean;
  /** Log level */
  logLevel: "silent" | "error" | "warn" | "info" | "debug";
}

export interface GeoState {
  /** Cumulative time saved by optimizations (ms) */
  totalTimeSavedMs: number;
  /** Total samples taken */
  totalSamples: number;
  /** Cold loads avoided via prestaging */
  coldLoadsAvoided: number;
  /** Cache hits / misses */
  cacheHits: number;
  cacheMisses: number;
  /** Dormancy events count */
  dormancyEvents: number;
  /** Last sample timestamp */
  lastSampleAt: string | null;
  /** Average φ-compliance (how well we stayed within budget) */
  avgPhiCompliance: number;
  /** Uptime in seconds */
  uptimeSeconds: number;
}

export interface GeoPayload {
  identity: GeoIdentity;
  config: GeoConfig;
  state: GeoState;
  /** Arbitrary extension data (tier 2/3 can store here) */
  extensions: Record<string, unknown>;
}

// ── Defaults ───────────────────────────────────────────────────────────

function generateId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "spore-";
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function hostFingerprint(): string {
  const os = require("os");
  const crypto = require("crypto");
  const raw = `${os.hostname()}-${os.platform()}-${os.arch()}-${os.cpus()[0]?.model ?? "unknown"}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

export function defaultPayload(): GeoPayload {
  return {
    identity: {
      id: generateId(),
      name: "Shovelcat Spore",
      createdAt: new Date().toISOString(),
      hostHash: hostFingerprint(),
    },
    config: {
      userCeiling: 0.5,
      sampleIntervalMs: 5000,
      maxHistory: 120,
      daemon: false,
      logLevel: "warn",
    },
    state: {
      totalTimeSavedMs: 0,
      totalSamples: 0,
      coldLoadsAvoided: 0,
      cacheHits: 0,
      cacheMisses: 0,
      dormancyEvents: 0,
      lastSampleAt: null,
      avgPhiCompliance: 1.0,
      uptimeSeconds: 0,
    },
    extensions: {},
  };
}

// ── Read / Write ───────────────────────────────────────────────────────

export function writeGeo(filePath: string, payload: GeoPayload, flags: number = 0): void {
  const json = JSON.stringify(payload, null, 2);
  const jsonBuf = Buffer.from(json, "utf-8");

  const header = Buffer.alloc(HEADER_SIZE);
  MAGIC.copy(header, 0);
  header.writeUInt32LE(VERSION, 4);
  header.writeUInt32LE(flags, 8);
  header.writeUInt32LE(jsonBuf.length, 12);

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, Buffer.concat([header, jsonBuf]));
}

export function readGeo(filePath: string): { payload: GeoPayload; flags: number; version: number } {
  const buf = fs.readFileSync(filePath);

  if (buf.length < HEADER_SIZE) {
    throw new Error(`Invalid .geo file: too small (${buf.length} bytes)`);
  }

  // Validate magic
  if (!buf.subarray(0, 4).equals(MAGIC)) {
    throw new Error("Invalid .geo file: bad magic bytes");
  }

  const version = buf.readUInt32LE(4);
  const flags = buf.readUInt32LE(8);
  const jsonLen = buf.readUInt32LE(12);

  if (buf.length < HEADER_SIZE + jsonLen) {
    throw new Error(`Invalid .geo file: payload truncated (expected ${jsonLen}, got ${buf.length - HEADER_SIZE})`);
  }

  if (flags & GEO_FLAG.ENCRYPTED) {
    throw new Error("Encrypted .geo files not yet supported");
  }

  const jsonStr = buf.subarray(HEADER_SIZE, HEADER_SIZE + jsonLen).toString("utf-8");
  const payload = JSON.parse(jsonStr) as GeoPayload;

  return { payload, flags, version };
}

// ── Helpers ────────────────────────────────────────────────────────────

/** Load or create a .geo file */
export function loadOrCreate(filePath: string): { payload: GeoPayload; flags: number; isNew: boolean } {
  if (fs.existsSync(filePath)) {
    const { payload, flags } = readGeo(filePath);
    return { payload, flags, isNew: false };
  }

  const payload = defaultPayload();
  writeGeo(filePath, payload, 0);
  return { payload, flags: 0, isNew: true };
}

/** Update state in an existing .geo file */
export function updateState(filePath: string, updates: Partial<GeoState>): void {
  const { payload, flags } = readGeo(filePath);
  Object.assign(payload.state, updates);
  writeGeo(filePath, payload, flags);
}

/** Update config in an existing .geo file */
export function updateConfig(filePath: string, updates: Partial<GeoConfig>): void {
  const { payload, flags } = readGeo(filePath);
  Object.assign(payload.config, updates);
  writeGeo(filePath, payload, flags);
}

/** Set or clear a flag */
export function setFlag(filePath: string, flag: number, on: boolean): void {
  const { payload, flags } = readGeo(filePath);
  const newFlags = on ? (flags | flag) : (flags & ~flag);
  writeGeo(filePath, payload, newFlags);
}

/** Get the default .geo file path for this system */
export function defaultGeoPath(): string {
  const os = require("os");
  const home = os.homedir();
  return path.join(home, ".shovelcat", "spore.geo");
}
