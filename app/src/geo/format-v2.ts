/**
 * .GEO V2 CONTAINER FORMAT
 * ========================
 *
 * V2 keeps the current binary+JSON envelope, but the payload changes from
 * a simple spore state object into a loop-based media container.
 *
 * Core ideas captured here:
 * - identity belongs to the full closed path, not any single point
 * - path segments are quaternion deltas (w, x, y, z)
 * - bubbles are closure/keyframe points inserted at thresholds
 * - layers project the same object into display, sound, text, code, storage
 *
 * This module is intentionally additive: v1 remains the active spore format.
 * V2 gives us a compile-safe place to grow the next format without breaking
 * the current CLI and derivative chain.
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

const MAGIC_V2 = Buffer.from([0x47, 0x45, 0x4f, 0x02]); // "GEO\x02"
const VERSION_V2 = 2;
const HEADER_SIZE = 16; // 4 + 4 + 4 + 4

export type GeoV2Axis = "w" | "x" | "y" | "z";

export type GeoV2ProjectionKind =
  | "text"
  | "audio"
  | "image"
  | "video"
  | "code"
  | "metadata"
  | "binary"
  | "latent";

export type GeoV2BubbleRole =
  | "origin"
  | "threshold"
  | "projection"
  | "sync"
  | "closure";

export type GeoV2LayerRole =
  | "display"
  | "code"
  | "storage"
  | "sound"
  | "text"
  | "custom";

export type GeoV2Encoding =
  | "inline-text"
  | "base64"
  | "external-ref"
  | "chunk-ref";

export interface GeoV2Quaternion {
  w: number;
  x: number;
  y: number;
  z: number;
}

export interface GeoV2Thresholds {
  /** Smallest allowed spacing between bubble placements. */
  minBubbleSpacing: number;
  /** Arc-length threshold that forces a bubble. */
  bubbleDistance: number;
  /** Maximum allowed phase drift on the real axis before closure. */
  phaseThreshold: number;
  /** Maximum allowed turn angle between adjacent segments. */
  curvatureThreshold: number;
  /** Dominance score (0-1) after which one axis should stabilize into a bubble. */
  axisLockThreshold: number;
}

export interface GeoV2Layer {
  id: string;
  depth: number;
  role: GeoV2LayerRole;
  label: string;
  description: string;
}

export interface GeoV2Manifest {
  id: string;
  name: string;
  createdAt: string;
  schemaVersion: string;
  loopIdentity: string;
  primaryProjection: GeoV2ProjectionKind;
  hWindow: number;
  thresholds: GeoV2Thresholds;
  layers: GeoV2Layer[];
  tags: string[];
  extensions: Record<string, unknown>;
}

export interface GeoV2Bubble {
  id: string;
  role: GeoV2BubbleRole;
  label: string;
  position: GeoV2Quaternion;
  layerDepth: number;
  radius: number;
  hWindowIndex: number;
  notes?: string;
}

export interface GeoV2Track {
  id: string;
  kind: GeoV2ProjectionKind;
  label: string;
  mimeType: string;
  encoding: GeoV2Encoding;
  layerDepth: number;
  byteLength: number;
  axisWeights: GeoV2Quaternion;
  contentHash?: string;
  contentRef?: string;
  inlineText?: string;
  metadata?: Record<string, unknown>;
}

export interface GeoV2Segment {
  id: string;
  from: GeoV2Quaternion;
  to: GeoV2Quaternion;
  delta: GeoV2Quaternion;
  magnitude: number;
  dominantAxis: GeoV2Axis;
  axisDominance: number;
  layerDepth: number;
  trackIds: string[];
  bubbleStartId?: string;
  bubbleEndId?: string;
  reason?: string;
}

export interface GeoV2ClosureState {
  closed: boolean;
  checksum: string;
  loopLength: number;
  reason: string;
}

export interface GeoV2Container {
  manifest: GeoV2Manifest;
  bubbles: GeoV2Bubble[];
  segments: GeoV2Segment[];
  tracks: GeoV2Track[];
  closure: GeoV2ClosureState;
}

export interface GeoV2ThresholdResult {
  insertBubble: boolean;
  reasons: string[];
  distanceFromBubble: number;
  phaseDrift: number;
  curvature: number;
  axisDominance: number;
}

export interface GeoV2AppendSegmentInput {
  delta: GeoV2Quaternion;
  layerDepth?: number;
  trackIds?: string[];
  label?: string;
  notes?: string;
  forceBubble?: boolean;
  bubbleRole?: Exclude<GeoV2BubbleRole, "origin">;
}

export interface GeoV2AppendSegmentResult {
  segment: GeoV2Segment;
  bubble?: GeoV2Bubble;
  threshold: GeoV2ThresholdResult;
}

export interface GeoV2CreateTrackInput {
  kind: GeoV2ProjectionKind;
  label: string;
  mimeType: string;
  encoding?: GeoV2Encoding;
  layerDepth?: number;
  inlineText?: string;
  contentRef?: string;
  contentHash?: string;
  byteLength?: number;
  axisWeights?: GeoV2Quaternion;
  metadata?: Record<string, unknown>;
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function zeroQuaternion(): GeoV2Quaternion {
  return { w: 0, x: 0, y: 0, z: 0 };
}

function cloneQuaternion(value: GeoV2Quaternion): GeoV2Quaternion {
  return { w: value.w, x: value.x, y: value.y, z: value.z };
}

function addQuaternion(a: GeoV2Quaternion, b: GeoV2Quaternion): GeoV2Quaternion {
  return {
    w: a.w + b.w,
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  };
}

function subtractQuaternion(a: GeoV2Quaternion, b: GeoV2Quaternion): GeoV2Quaternion {
  return {
    w: a.w - b.w,
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  };
}

function dotQuaternion(a: GeoV2Quaternion, b: GeoV2Quaternion): number {
  return a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;
}

export function quaternionMagnitude(value: GeoV2Quaternion): number {
  return Math.sqrt(dotQuaternion(value, value));
}

export function dominantQuaternionAxis(value: GeoV2Quaternion): GeoV2Axis {
  const pairs: Array<[GeoV2Axis, number]> = [
    ["w", Math.abs(value.w)],
    ["x", Math.abs(value.x)],
    ["y", Math.abs(value.y)],
    ["z", Math.abs(value.z)],
  ];

  pairs.sort((a, b) => b[1] - a[1]);
  return pairs[0][0];
}

export function axisDominance(value: GeoV2Quaternion): number {
  const magnitude = quaternionMagnitude(value);
  if (magnitude === 0) {
    return 0;
  }

  const axis = dominantQuaternionAxis(value);
  return Math.abs(value[axis]) / magnitude;
}

export function quaternionAngle(a: GeoV2Quaternion, b: GeoV2Quaternion): number {
  const magA = quaternionMagnitude(a);
  const magB = quaternionMagnitude(b);
  if (magA === 0 || magB === 0) {
    return 0;
  }

  const cosTheta = dotQuaternion(a, b) / (magA * magB);
  const safe = Math.max(-1, Math.min(1, cosTheta));
  return Math.acos(safe);
}

export function distanceQuaternion(a: GeoV2Quaternion, b: GeoV2Quaternion): number {
  return quaternionMagnitude(subtractQuaternion(a, b));
}

export function defaultGeoV2Layers(): GeoV2Layer[] {
  return [
    {
      id: "layer-display",
      depth: 0,
      role: "display",
      label: "Display Plane",
      description: "Visible bubble field projected onto the screen plane.",
    },
    {
      id: "layer-code",
      depth: 1,
      role: "code",
      label: "Code Layer",
      description: "Hidden joins, update rules, and execution logic behind the display plane.",
    },
    {
      id: "layer-storage",
      depth: 2,
      role: "storage",
      label: "Storage Layer",
      description: "Persistent history, receipts, and recoverable object memory.",
    },
    {
      id: "layer-sound",
      depth: -1,
      role: "sound",
      label: "Sound Layer",
      description: "Resonance and waveform projection beneath the visible plane.",
    },
    {
      id: "layer-text",
      depth: -2,
      role: "text",
      label: "Text Layer",
      description: "Symbolic and linguistic projection beneath the sound layer.",
    },
  ];
}

export function defaultGeoV2Thresholds(hWindow: number = 1): GeoV2Thresholds {
  return {
    minBubbleSpacing: hWindow,
    bubbleDistance: hWindow * 4,
    phaseThreshold: Math.PI / 4,
    curvatureThreshold: Math.PI / 2,
    axisLockThreshold: 0.82,
  };
}

function computeLoopIdentity(container: Pick<GeoV2Container, "bubbles" | "segments" | "tracks">): string {
  const canonical = JSON.stringify({
    bubbles: container.bubbles.map((bubble) => ({
      role: bubble.role,
      position: bubble.position,
      layerDepth: bubble.layerDepth,
      hWindowIndex: bubble.hWindowIndex,
    })),
    segments: container.segments.map((segment) => ({
      delta: segment.delta,
      layerDepth: segment.layerDepth,
      trackIds: [...segment.trackIds].sort(),
    })),
    tracks: container.tracks.map((track) => ({
      kind: track.kind,
      layerDepth: track.layerDepth,
      axisWeights: track.axisWeights,
      contentHash: track.contentHash ?? null,
      contentRef: track.contentRef ?? null,
      inlineText: track.inlineText ?? null,
    })),
  });

  return crypto.createHash("sha256").update(canonical).digest("hex");
}

function computeLoopLength(segments: GeoV2Segment[]): number {
  return segments.reduce((sum, segment) => sum + segment.magnitude, 0);
}

function originBubble(hWindow: number): GeoV2Bubble {
  return {
    id: createId("bubble"),
    role: "origin",
    label: "origin",
    position: zeroQuaternion(),
    layerDepth: 0,
    radius: hWindow,
    hWindowIndex: 0,
    notes: "Required entry bubble. Identity begins here and closes back here.",
  };
}

function lastItem<T>(items: T[]): T | undefined {
  return items.length > 0 ? items[items.length - 1] : undefined;
}

function currentCursor(container: GeoV2Container): GeoV2Quaternion {
  const lastSegment = lastItem(container.segments);
  if (lastSegment) {
    return cloneQuaternion(lastSegment.to);
  }
  return cloneQuaternion(container.bubbles[0].position);
}

function currentBubbleId(container: GeoV2Container): string {
  const lastSegment = lastItem(container.segments);
  if (lastSegment?.bubbleEndId) {
    return lastSegment.bubbleEndId;
  }
  return container.bubbles[0].id;
}

function bubbleIndexForPosition(position: GeoV2Quaternion, hWindow: number): number {
  if (hWindow <= 0) {
    return 0;
  }
  return Math.round(quaternionMagnitude(position) / hWindow);
}

function refreshLoopMetadata(container: GeoV2Container, closed: boolean, reason: string): void {
  const checksum = computeLoopIdentity(container);
  container.manifest.loopIdentity = checksum;
  container.closure = {
    closed,
    checksum,
    loopLength: computeLoopLength(container.segments),
    reason,
  };
}

export function defaultGeoV2(
  name: string = "Shovelcat Object",
  primaryProjection: GeoV2ProjectionKind = "video",
  hWindow: number = 1
): GeoV2Container {
  const bubble = originBubble(hWindow);
  const container: GeoV2Container = {
    manifest: {
      id: createId("geo"),
      name,
      createdAt: new Date().toISOString(),
      schemaVersion: "2.0.0-draft",
      loopIdentity: "",
      primaryProjection,
      hWindow,
      thresholds: defaultGeoV2Thresholds(hWindow),
      layers: defaultGeoV2Layers(),
      tags: ["geo-v2", "loop-identity", "bubble-field"],
      extensions: {},
    },
    bubbles: [bubble],
    segments: [],
    tracks: [],
    closure: {
      closed: false,
      checksum: "",
      loopLength: 0,
      reason: "open-origin",
    },
  };

  refreshLoopMetadata(container, false, "open-origin");
  return container;
}

export function createGeoV2Track(input: GeoV2CreateTrackInput): GeoV2Track {
  const inlineBytes = input.inlineText
    ? Buffer.byteLength(input.inlineText, "utf-8")
    : 0;

  return {
    id: createId("track"),
    kind: input.kind,
    label: input.label,
    mimeType: input.mimeType,
    encoding: input.encoding ?? (input.inlineText ? "inline-text" : "external-ref"),
    layerDepth: input.layerDepth ?? 0,
    byteLength: input.byteLength ?? inlineBytes,
    axisWeights: input.axisWeights ?? zeroQuaternion(),
    contentHash: input.contentHash,
    contentRef: input.contentRef,
    inlineText: input.inlineText,
    metadata: input.metadata,
  };
}

export function addGeoV2Track(container: GeoV2Container, track: GeoV2Track): GeoV2Track {
  container.tracks.push(track);
  refreshLoopMetadata(container, container.closure.closed, container.closure.reason);
  return track;
}

export function evaluateBubbleThreshold(
  container: GeoV2Container,
  nextPosition: GeoV2Quaternion,
  delta: GeoV2Quaternion
): GeoV2ThresholdResult {
  const thresholds = container.manifest.thresholds;
  const lastBubble = lastItem(container.bubbles) ?? container.bubbles[0];
  const previousSegment = lastItem(container.segments);
  const distanceFromBubble = distanceQuaternion(lastBubble.position, nextPosition);
  const phaseDrift = Math.abs(delta.w);
  const curvature = previousSegment ? quaternionAngle(previousSegment.delta, delta) : 0;
  const dominance = axisDominance(delta);
  const reasons: string[] = [];

  if (distanceFromBubble >= thresholds.bubbleDistance) {
    reasons.push("distance");
  }
  if (phaseDrift >= thresholds.phaseThreshold) {
    reasons.push("phase");
  }
  if (curvature >= thresholds.curvatureThreshold) {
    reasons.push("curvature");
  }
  if (dominance >= thresholds.axisLockThreshold) {
    reasons.push("axis-lock");
  }

  const insertBubble =
    reasons.length > 0 && distanceFromBubble >= thresholds.minBubbleSpacing;

  return {
    insertBubble,
    reasons,
    distanceFromBubble,
    phaseDrift,
    curvature,
    axisDominance: dominance,
  };
}

export function appendGeoV2Segment(
  container: GeoV2Container,
  input: GeoV2AppendSegmentInput
): GeoV2AppendSegmentResult {
  const start = currentCursor(container);
  const end = addQuaternion(start, input.delta);
  const threshold = evaluateBubbleThreshold(container, end, input.delta);

  const segment: GeoV2Segment = {
    id: createId("segment"),
    from: start,
    to: end,
    delta: cloneQuaternion(input.delta),
    magnitude: quaternionMagnitude(input.delta),
    dominantAxis: dominantQuaternionAxis(input.delta),
    axisDominance: threshold.axisDominance,
    layerDepth: input.layerDepth ?? 0,
    trackIds: input.trackIds ?? [],
    bubbleStartId: currentBubbleId(container),
    reason: input.notes ?? input.label,
  };

  let bubble: GeoV2Bubble | undefined;
  if (input.forceBubble || threshold.insertBubble) {
    bubble = {
      id: createId("bubble"),
      role: input.bubbleRole ?? "threshold",
      label: input.label ?? (threshold.reasons.join("+") || "threshold"),
      position: end,
      layerDepth: input.layerDepth ?? 0,
      radius: container.manifest.hWindow,
      hWindowIndex: bubbleIndexForPosition(end, container.manifest.hWindow),
      notes: input.notes ?? threshold.reasons.join(", "),
    };
    segment.bubbleEndId = bubble.id;
  }

  container.segments.push(segment);
  if (bubble) {
    container.bubbles.push(bubble);
  }

  refreshLoopMetadata(container, false, bubble ? "open-bubble" : "open-path");

  return { segment, bubble, threshold };
}

export function closeGeoV2Loop(
  container: GeoV2Container,
  layerDepth: number = 0
): GeoV2AppendSegmentResult {
  const cursor = currentCursor(container);
  const origin = container.bubbles[0].position;
  const delta = subtractQuaternion(origin, cursor);

  const result = appendGeoV2Segment(container, {
    delta,
    layerDepth,
    label: "closure",
    notes: "Return to the origin bubble and seal the loop identity.",
    forceBubble: true,
    bubbleRole: "closure",
  });

  refreshLoopMetadata(container, true, "closed-loop");
  return result;
}

export function writeGeoV2(filePath: string, container: GeoV2Container, flags: number = 0): void {
  const json = JSON.stringify(container, null, 2);
  const jsonBuffer = Buffer.from(json, "utf-8");

  const header = Buffer.alloc(HEADER_SIZE);
  MAGIC_V2.copy(header, 0);
  header.writeUInt32LE(VERSION_V2, 4);
  header.writeUInt32LE(flags, 8);
  header.writeUInt32LE(jsonBuffer.length, 12);

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, Buffer.concat([header, jsonBuffer]));
}

export function readGeoV2(filePath: string): {
  container: GeoV2Container;
  flags: number;
  version: number;
} {
  const buffer = fs.readFileSync(filePath);

  if (buffer.length < HEADER_SIZE) {
    throw new Error(`Invalid .geo v2 file: too small (${buffer.length} bytes)`);
  }

  if (!buffer.subarray(0, 4).equals(MAGIC_V2)) {
    throw new Error("Invalid .geo v2 file: bad magic bytes");
  }

  const version = buffer.readUInt32LE(4);
  const flags = buffer.readUInt32LE(8);
  const payloadLength = buffer.readUInt32LE(12);

  if (buffer.length < HEADER_SIZE + payloadLength) {
    throw new Error(
      `Invalid .geo v2 file: payload truncated (expected ${payloadLength}, got ${buffer.length - HEADER_SIZE})`
    );
  }

  const json = buffer.subarray(HEADER_SIZE, HEADER_SIZE + payloadLength).toString("utf-8");
  const container = JSON.parse(json) as GeoV2Container;

  refreshLoopMetadata(container, container.closure.closed, container.closure.reason);
  return { container, flags, version };
}
