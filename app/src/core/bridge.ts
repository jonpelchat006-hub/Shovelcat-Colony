/**
 * BRIDGE — The C: → D: Interface
 * ===============================
 *
 * C: drive doesn't sort anything. It pumps raw data into the bridge.
 * D: drive (the spiral OS) handles all placement, classification,
 * and retrieval through the tensor field.
 *
 * THE FLOW:
 *
 *   C: writes raw file to → D:\shovelcat-colony\bridge\intake\
 *   Bridge daemon detects it, classifies it:
 *     1. TEMPERATURE — how frequently will this be accessed?
 *        Hot (L0-L1), Warm (L2-L3), Cool (L4), Cold (L5-L7)
 *     2. TENSOR AXIS — what kind of data is this?
 *        facts (structured, verifiable), memory (contextual, emotional),
 *        imagination (creative, speculative, raw)
 *     3. ZONE — where does it physically go?
 *        Temperature → zone level, axis → collapsed layer
 *
 *   D: moves the file to the correct zone/data/ directory.
 *   D: creates tensor refs in the collapsed zones if applicable.
 *   D: writes a receipt to → D:\shovelcat-colony\bridge\[branch]\
 *
 *   C: reads receipts from its branch perspective:
 *     bridge\ai\     → facts-first view
 *     bridge\club\   → imagination-first view
 *     bridge\alpha\  → memory-first view (the bridge between both)
 *
 * WHAT C: SEES:
 *
 *   C: never sees zone directories. It sees THREE views of the same data:
 *
 *     bridge\ai\AAPL.json         → { verified: true, risk: "LOW", ... }
 *     bridge\club\AAPL.json       → { potential: "HIGH", thesis: "...", ... }
 *     bridge\alpha\AAPL.json      → { history: [...], pattern: "...", ... }
 *
 *   Same underlying data (in zones), three perspectives (from tensor axes).
 *   C: picks the branch that matches what it needs right now.
 *
 * WHY THIS WORKS:
 *
 *   C: is the USER — it has apps, games, the website, Ollama models.
 *   D: is the BRAIN — it sorts, verifies, remembers, imagines.
 *   The bridge is the SPINAL CORD — raw signals in, structured signals out.
 *
 *   C: doesn't need to know about Fibonacci zones, hex VMs, or tensor pressure.
 *   It just drops files and reads results. The OS handles everything.
 *
 * Author: Jonathan Pelchat
 * Shovelcat Theory — The Bridge
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { PHI, DELTA } from "./quaternion-chain";

// ── Constants ────────────────────────────────────────────────────────────

const COLONY_ROOT = "D:\\shovelcat-colony";
const ZONES_DIR = path.join(COLONY_ROOT, "zones");
const BRIDGE_DIR = path.join(COLONY_ROOT, "bridge");
const INTAKE_DIR = path.join(BRIDGE_DIR, "intake");
const FEEDBACK_DIR = path.join(COLONY_ROOT, "feedback");

const ZONE_NAMES = [
  "L0-origin", "L1-time", "L2-plane", "L3-space", "L4-spacetime",
  "L5-facts", "L6-memory", "L7-imagination",
];

// ── Classification ──────────────────────────────────────────────────────

/** Temperature classification — how hot is this data? */
export type Temperature = "hot" | "warm" | "cool" | "cold";

/** Tensor axis classification */
export type DataAxis = "facts" | "memory" | "imagination";

/** File type hints for classification */
interface FileSignature {
  extensions: string[];
  temperature: Temperature;
  axis: DataAxis;
  zone: number;
}

/**
 * Classification rules — maps file characteristics to zone placement.
 *
 * The bridge doesn't need ML for this. File type + size + access pattern
 * gives us enough signal. The tensor field handles the rest.
 */
const SIGNATURES: FileSignature[] = [
  // HOT — L0: system config, indices, small lookup tables
  { extensions: [".json", ".toml", ".yaml", ".yml", ".ini", ".cfg", ".env"],
    temperature: "hot", axis: "facts", zone: 0 },
  { extensions: [".idx", ".index", ".db-journal", ".wal"],
    temperature: "hot", axis: "facts", zone: 0 },

  // HOT — L1: metadata, headers, tokenizers, shaders
  { extensions: [".glsl", ".hlsl", ".wgsl", ".vert", ".frag", ".shader"],
    temperature: "hot", axis: "imagination", zone: 1 },
  { extensions: [".vocab", ".tokenizer", ".bpe", ".sentencepiece"],
    temperature: "hot", axis: "facts", zone: 1 },
  { extensions: [".meta", ".manifest", ".lock"],
    temperature: "hot", axis: "facts", zone: 1 },

  // WARM — L2: audio, frequently accessed small assets
  { extensions: [".wav", ".mp3", ".ogg", ".flac", ".aac", ".opus"],
    temperature: "warm", axis: "memory", zone: 2 },
  { extensions: [".ico", ".svg", ".cur"],
    temperature: "warm", axis: "imagination", zone: 2 },

  // WARM — L3: textures, images, embeddings
  { extensions: [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tga", ".dds", ".ktx"],
    temperature: "warm", axis: "imagination", zone: 3 },
  { extensions: [".npy", ".npz", ".safetensors", ".embedding"],
    temperature: "warm", axis: "memory", zone: 3 },

  // COOL — L4: models, large datasets, databases (classical boundary)
  { extensions: [".gguf", ".ggml", ".bin", ".pt", ".pth", ".onnx", ".tflite"],
    temperature: "cool", axis: "facts", zone: 4 },
  { extensions: [".db", ".sqlite", ".sqlite3", ".mdb"],
    temperature: "cool", axis: "facts", zone: 4 },
  { extensions: [".csv", ".parquet", ".arrow", ".feather"],
    temperature: "cool", axis: "facts", zone: 4 },
  { extensions: [".zip", ".tar", ".gz", ".7z", ".rar"],
    temperature: "cool", axis: "memory", zone: 4 },

  // COLD — L5: structured data for verification (facts axis)
  { extensions: [".log", ".audit", ".trace", ".evidence"],
    temperature: "cold", axis: "facts", zone: 5 },

  // COLD — L6: contextual/historical data (memory axis)
  { extensions: [".journal", ".history", ".timeline", ".memory"],
    temperature: "cold", axis: "memory", zone: 6 },

  // COLD — L7: creative/speculative data (imagination axis)
  { extensions: [".draft", ".sketch", ".concept", ".hypothesis", ".thesis"],
    temperature: "cold", axis: "imagination", zone: 7 },

  // Video — splits across zones by frame type (handled specially)
  { extensions: [".mp4", ".mkv", ".avi", ".mov", ".webm"],
    temperature: "cool", axis: "imagination", zone: 4 },
];

/** Default for unrecognized files — start at L7 (imagination/new) and migrate */
const DEFAULT_SIGNATURE: FileSignature = {
  extensions: [],
  temperature: "cold",
  axis: "imagination",
  zone: 7,
};

// ── Intake Receipt ───────────────────────────────────────────────────────

/**
 * A receipt for processed data — what C: reads back.
 *
 * Each branch directory gets a receipt with that branch's perspective.
 */
export interface IntakeReceipt {
  /** Original filename */
  filename: string;
  /** Unique ID assigned by the bridge */
  id: string;
  /** When the bridge processed this */
  timestamp: string;
  /** Size in bytes */
  sizeBytes: number;
  /** SHA-256 hash of content */
  hash: string;

  /** Classification results */
  classification: {
    temperature: Temperature;
    primaryAxis: DataAxis;
    zone: number;
    zoneName: string;
    collapsed: boolean;
  };

  /** Where the file physically lives now */
  storage: {
    zonePath: string;
    dataPath: string;
  };

  /** Branch-specific perspective */
  perspective: {
    branch: "ai" | "club" | "alpha";
    axis: DataAxis;
    /** What this data means from this branch's view */
    interpretation: string;
  };
}

// ── Classification Engine ────────────────────────────────────────────────

export interface ClassificationResult {
  temperature: Temperature;
  axis: DataAxis;
  zone: number;
  confidence: number;
  reason: string;
}

/**
 * Classify a file for zone placement.
 *
 * Uses file extension + size heuristics. Unknown files go to L7
 * (imagination = new/unverified) and migrate inward as they're accessed.
 */
export function classifyFile(
  filename: string,
  sizeBytes: number,
): ClassificationResult {
  const ext = path.extname(filename).toLowerCase();

  // Find matching signature
  const sig = SIGNATURES.find(s => s.extensions.includes(ext));

  if (sig) {
    // Size-based zone adjustment: very large files shift outward
    let zone = sig.zone;
    if (sizeBytes > 1024 * 1024 * 1024) {
      // > 1GB: push toward outer zones
      zone = Math.min(7, zone + 2);
    } else if (sizeBytes > 100 * 1024 * 1024) {
      // > 100MB: push one zone out
      zone = Math.min(7, zone + 1);
    } else if (sizeBytes < 1024) {
      // < 1KB: pull toward center (hot)
      zone = Math.max(0, zone - 1);
    }

    return {
      temperature: sig.temperature,
      axis: sig.axis,
      zone,
      confidence: 0.9,
      reason: `Extension ${ext} → ${sig.temperature} (${sig.axis})`,
    };
  }

  // Unknown: start at L7, the imagination zone
  // Everything new begins as possibility — unverified, uncategorized
  // The consciousness loop will migrate it inward as it's used
  return {
    ...DEFAULT_SIGNATURE,
    confidence: 0.3,
    reason: `Unknown extension ${ext || "(none)"} → L7 (new data starts as imagination)`,
  };
}

// ── Bridge Operations ────────────────────────────────────────────────────

/**
 * Process a file through the bridge.
 *
 * This is the core operation: C: drops a file, D: classifies it,
 * moves it to the correct zone, and writes receipts for each branch.
 *
 * The file is MOVED, not copied — it leaves C: and lives on D: now.
 * C: gets back receipts that describe where to find it and what it means.
 */
export function processIntake(
  filePath: string,
  options: {
    /** Keep original file (copy instead of move) */
    keepOriginal?: boolean;
    /** Override classification */
    forceAxis?: DataAxis;
    forceZone?: number;
  } = {},
): IntakeReceipt[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const stats = fs.statSync(filePath);
  const filename = path.basename(filePath);
  const content = fs.readFileSync(filePath);

  // Generate ID and hash
  const id = crypto.randomBytes(8).toString("hex");
  const hash = crypto.createHash("sha256").update(content).digest("hex");

  // Classify
  const classification = classifyFile(filename, stats.size);
  const zone = options.forceZone ?? classification.zone;
  const axis = options.forceAxis ?? classification.axis;
  const collapsed = zone >= 5;

  // Determine storage path
  const zoneName = ZONE_NAMES[zone];
  const zonePath = path.join(ZONES_DIR, zoneName);
  const dataDir = path.join(zonePath, "data");
  const dataPath = path.join(dataDir, `${id}_${filename}`);

  // Move/copy the file to its zone
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (options.keepOriginal) {
    fs.copyFileSync(filePath, dataPath);
  } else {
    // Move: copy then delete (cross-drive moves need this)
    fs.copyFileSync(filePath, dataPath);
    fs.unlinkSync(filePath);
  }

  // Write to collapsed zone input if applicable
  if (collapsed) {
    const inputDir = path.join(zonePath, "input");
    if (fs.existsSync(inputDir)) {
      const inputRef = {
        id, filename, hash, axis, zone,
        dataPath, timestamp: new Date().toISOString(),
        sizeBytes: stats.size,
      };
      fs.writeFileSync(
        path.join(inputDir, `${id}.json`),
        JSON.stringify(inputRef, null, 2),
      );
    }
  }

  // Generate receipts for each branch
  const branches = ["ai", "club", "alpha"] as const;
  const branchAxes: Record<typeof branches[number], DataAxis> = {
    ai: "facts",
    club: "imagination",
    alpha: "memory",
  };

  const interpretations: Record<typeof branches[number], (f: string, t: Temperature) => string> = {
    ai: (f, t) => `Verified ${t} data: ${f} — stored at L${zone} for ${axis} processing`,
    club: (f, t) => `New possibility: ${f} — ${t === "cold" ? "unexplored territory" : "active material"} at L${zone}`,
    alpha: (f, t) => `Contextual entry: ${f} — ${t} data with ${axis} character, zone L${zone}`,
  };

  const receipts: IntakeReceipt[] = [];

  for (const branch of branches) {
    const receipt: IntakeReceipt = {
      filename,
      id,
      timestamp: new Date().toISOString(),
      sizeBytes: stats.size,
      hash,
      classification: {
        temperature: classification.temperature,
        primaryAxis: axis,
        zone,
        zoneName,
        collapsed,
      },
      storage: {
        zonePath,
        dataPath,
      },
      perspective: {
        branch,
        axis: branchAxes[branch],
        interpretation: interpretations[branch](filename, classification.temperature),
      },
    };

    // Write receipt to branch directory
    const branchDir = path.join(BRIDGE_DIR, branch);
    if (!fs.existsSync(branchDir)) {
      fs.mkdirSync(branchDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(branchDir, `${id}_${filename}.json`),
      JSON.stringify(receipt, null, 2),
    );

    receipts.push(receipt);
  }

  return receipts;
}

/**
 * Query the bridge for data by filename pattern.
 *
 * C: asks "what do you have about X?" and gets back receipts
 * from its branch perspective.
 */
export function queryBridge(
  branch: "ai" | "club" | "alpha",
  pattern?: string,
): IntakeReceipt[] {
  const branchDir = path.join(BRIDGE_DIR, branch);
  if (!fs.existsSync(branchDir)) return [];

  const files = fs.readdirSync(branchDir).filter(f => f.endsWith(".json"));
  const receipts: IntakeReceipt[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(branchDir, file), "utf-8");
      const receipt = JSON.parse(content) as IntakeReceipt;

      if (!pattern || receipt.filename.toLowerCase().includes(pattern.toLowerCase())) {
        receipts.push(receipt);
      }
    } catch {
      // Skip malformed receipts
    }
  }

  return receipts;
}

/**
 * List all data in a specific zone.
 */
export function listZone(zone: number): Array<{
  filename: string;
  sizeBytes: number;
  path: string;
}> {
  const zoneName = ZONE_NAMES[zone];
  if (!zoneName) return [];

  const dataDir = path.join(ZONES_DIR, zoneName, "data");
  if (!fs.existsSync(dataDir)) return [];

  return fs.readdirSync(dataDir).map(filename => {
    const filePath = path.join(dataDir, filename);
    const stats = fs.statSync(filePath);
    return { filename, sizeBytes: stats.size, path: filePath };
  });
}

/**
 * Migrate data between zones (temperature change).
 *
 * As data is accessed more, it migrates inward (hotter zones).
 * As data is forgotten, it migrates outward (colder zones).
 * This is the consciousness loop at the drive level:
 *   New data (L7) → verified (L5) → classical (L4) → hot (L0)
 */
export function migrateData(
  dataId: string,
  fromZone: number,
  toZone: number,
): boolean {
  const fromDir = path.join(ZONES_DIR, ZONE_NAMES[fromZone], "data");
  const toDir = path.join(ZONES_DIR, ZONE_NAMES[toZone], "data");

  if (!fs.existsSync(fromDir) || !fs.existsSync(toDir)) return false;

  // Find the file
  const files = fs.readdirSync(fromDir).filter(f => f.startsWith(dataId));
  if (files.length === 0) return false;

  const filename = files[0];
  const fromPath = path.join(fromDir, filename);
  const toPath = path.join(toDir, filename);

  fs.copyFileSync(fromPath, toPath);
  fs.unlinkSync(fromPath);

  // Update receipts in all branch directories
  for (const branch of ["ai", "club", "alpha"]) {
    const branchDir = path.join(BRIDGE_DIR, branch);
    const receiptFiles = fs.readdirSync(branchDir).filter(f => f.startsWith(dataId));
    for (const rf of receiptFiles) {
      try {
        const receiptPath = path.join(branchDir, rf);
        const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf-8")) as IntakeReceipt;
        receipt.classification.zone = toZone;
        receipt.classification.zoneName = ZONE_NAMES[toZone];
        receipt.classification.collapsed = toZone >= 5;
        receipt.storage.zonePath = path.join(ZONES_DIR, ZONE_NAMES[toZone]);
        receipt.storage.dataPath = toPath;
        fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
      } catch { /* skip */ }
    }
  }

  return true;
}

// ── Bridge Daemon (Watch Mode) ──────────────────────────────────────────

/**
 * Start watching the intake directory for new files.
 *
 * When C: drops a file into bridge\intake\, the daemon:
 * 1. Classifies it
 * 2. Moves it to the correct zone
 * 3. Writes receipts to each branch directory
 * 4. Logs the operation
 *
 * This is the "just pump data in" interface.
 */
export function startBridgeDaemon(options: {
  verbose?: boolean;
  pollIntervalMs?: number;
} = {}): { stop: () => void } {
  const verbose = options.verbose ?? true;
  const pollMs = options.pollIntervalMs ?? 1000;

  // Ensure intake directory exists
  if (!fs.existsSync(INTAKE_DIR)) {
    fs.mkdirSync(INTAKE_DIR, { recursive: true });
  }

  if (verbose) {
    console.log("BRIDGE DAEMON — Watching for incoming data");
    console.log("═".repeat(70));
    console.log(`  Intake:  ${INTAKE_DIR}`);
    console.log(`  Zones:   ${ZONES_DIR}`);
    console.log(`  Bridge:  ${BRIDGE_DIR}`);
    console.log(`  Poll:    ${pollMs}ms`);
    console.log();
    console.log("  Drop files into the intake directory. The bridge handles the rest.");
    console.log("  Receipts appear in bridge\\ai\\, bridge\\club\\, bridge\\alpha\\");
    console.log();
  }

  const processedSet = new Set<string>();

  const interval = setInterval(() => {
    try {
      const files = fs.readdirSync(INTAKE_DIR);
      for (const file of files) {
        if (processedSet.has(file)) continue;

        const filePath = path.join(INTAKE_DIR, file);
        const stats = fs.statSync(filePath);

        // Skip directories and empty files
        if (stats.isDirectory() || stats.size === 0) continue;

        try {
          const receipts = processIntake(filePath);
          processedSet.add(file);

          if (verbose && receipts.length > 0) {
            const r = receipts[0];
            console.log(`  [${new Date().toISOString().slice(11, 19)}] ${file}`);
            console.log(`    → ${r.classification.zoneName} (${r.classification.primaryAxis}, ${r.classification.temperature})`);
            console.log(`    → ${r.storage.dataPath}`);
          }
        } catch (e) {
          if (verbose) {
            console.log(`  [ERROR] ${file}: ${e}`);
          }
        }
      }
    } catch {
      // Intake dir might not exist yet
    }
  }, pollMs);

  return {
    stop: () => {
      clearInterval(interval);
      if (verbose) console.log("\nBridge daemon stopped.");
    },
  };
}

// ── Print Bridge Status ──────────────────────────────────────────────────

export function printBridgeStatus(): void {
  console.log("BRIDGE STATUS");
  console.log("═".repeat(70));

  // Count files per zone
  console.log("  ZONE CONTENTS:");
  console.log("  " + "─".repeat(56));
  let totalFiles = 0;
  let totalSize = 0;

  for (let z = 0; z < 8; z++) {
    const items = listZone(z);
    const zoneSize = items.reduce((s, i) => s + i.sizeBytes, 0);
    totalFiles += items.length;
    totalSize += zoneSize;

    if (items.length > 0) {
      const sizeStr = zoneSize >= 1024 * 1024
        ? (zoneSize / 1024 / 1024).toFixed(1) + "MB"
        : zoneSize >= 1024
          ? (zoneSize / 1024).toFixed(1) + "KB"
          : zoneSize + "B";
      console.log(`    ${ZONE_NAMES[z].padEnd(18)} ${String(items.length).padStart(5)} files  ${sizeStr.padStart(10)}`);
    }
  }

  console.log("  " + "─".repeat(56));
  const totalStr = totalSize >= 1024 * 1024 * 1024
    ? (totalSize / 1024 / 1024 / 1024).toFixed(2) + "GB"
    : (totalSize / 1024 / 1024).toFixed(1) + "MB";
  console.log(`    ${"TOTAL".padEnd(18)} ${String(totalFiles).padStart(5)} files  ${totalStr.padStart(10)}`);
  console.log();

  // Count receipts per branch
  console.log("  BRANCH RECEIPTS:");
  console.log("  " + "─".repeat(56));
  for (const branch of ["ai", "club", "alpha"]) {
    const branchDir = path.join(BRIDGE_DIR, branch);
    let count = 0;
    try {
      count = fs.readdirSync(branchDir).filter(f => f.endsWith(".json")).length;
    } catch { /* empty */ }
    const axis = branch === "ai" ? "facts" : branch === "club" ? "imagination" : "memory";
    console.log(`    ${branch.padEnd(8)} ${String(count).padStart(5)} receipts  (${axis} axis)`);
  }

  // Check intake
  let intakeCount = 0;
  try {
    intakeCount = fs.readdirSync(INTAKE_DIR).filter(f => !f.startsWith(".")).length;
  } catch { /* empty */ }

  console.log();
  console.log(`  INTAKE QUEUE: ${intakeCount} files waiting`);
  console.log(`  Drop files into: ${INTAKE_DIR}`);
  console.log();
}
