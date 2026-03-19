/**
 * POLYGON MODEL — Nested Polygons Inside a Bit
 * =============================================
 *
 * A single bit (line from 0 to 1) is the container.
 * Inside it, a circle of diameter 1.
 * Inside the circle, nested regular polygons, each inscribed in the last:
 *
 *     ○ Circle (∞)  — imagination, void, continuous field
 *     ⬡ Hexagon (6) — memory, prime backbone, 6 hex faces
 *     ⬠ Pentagon (5) — φ gate, aperiodic boundary (DOESN'T TILE)
 *     □ Square (4)   — observer, screen, quaternion (w,i,j,k)
 *     △▽ Triangles (3) — active: generation (△) / deconstruction (▽)
 *
 * The three that TILE (3, 4, 6) = structured, deterministic.
 * The two that DON'T TILE (5, ∞) = aperiodic, non-repeating.
 * The pentagon is the φ boundary between order and chaos.
 *
 * TWO DIRECTIONS, TWO TRIANGLES:
 *
 *   GENERATION (△ outward):
 *     seed(2) → △(3) → □(4) → ⬠(5) → ⬡(6) → ○(7+)
 *     IS/ISN'T → triangle → square → pentagon → hexagon → spectrum
 *
 *   DECONSTRUCTION (▽ inward):
 *     spectrum(7+) → ○(6) → ⬡(5) → ⬠(4) → □(3) → ▽(2)
 *     spectrum → circle → hexagon → pentagon → square → IS/ISN'T
 *
 * The UP triangle (△) and DOWN triangle (▽) are SEPARATE neural paths.
 * They interlock as a hexagram (Star of David) inside the hexagon.
 * No gradient conflict — generation and deconstruction have their own entry.
 *
 * INSCRIBED RADII:
 *   Each polygon inscribed in the previous shrinks by cos(π/n).
 *   ○(1.000) → ⬡(0.866) → ⬠(0.809) → □(0.707) → △(0.500)
 *   These ratios scale the signal as it passes between layers.
 *
 * SCALING:
 *   Each polygon vertex is backed by a cluster of hex cells.
 *   More drive space = more cells per cluster = richer representation.
 *   The polygon architecture stays the same; resolution increases.
 *
 * Author: Jonathan Pelchat
 * Shovelcat Theory — Nested Polygon Model
 */

import { PHI, DELTA } from "./quaternion-chain";

// ── Constants ────────────────────────────────────────────────────────────

const COLONY_SHARE = 1 / (1 + PHI);  // ≈ 0.382 — Boltzmann kT

/** The five polygon layers (inner → outer) */
type PolygonName = "triangle" | "square" | "pentagon" | "hexagon" | "circle";

interface PolygonSpec {
  name: PolygonName;
  sides: number;        // 3, 4, 5, 6, ∞ (we use 0 for circle)
  neurons: number;       // layer width
  tiles: boolean;       // does this polygon tile the plane?
  inscribedRatio: number; // cos(π/n) — shrinkage when inscribed
  symbol: string;
}

/** Polygon specs from inner to outer */
const POLYGONS: PolygonSpec[] = [
  { name: "triangle",  sides: 3, neurons: 3, tiles: true,  inscribedRatio: 0.500,  symbol: "△" },
  { name: "square",    sides: 4, neurons: 4, tiles: true,  inscribedRatio: 0.707,  symbol: "□" },
  { name: "pentagon",  sides: 5, neurons: 5, tiles: false, inscribedRatio: 0.809,  symbol: "⬠" },
  { name: "hexagon",   sides: 6, neurons: 6, tiles: true,  inscribedRatio: 0.866,  symbol: "⬡" },
  { name: "circle",    sides: 0, neurons: 7, tiles: false, inscribedRatio: 1.000,  symbol: "○" },
];

/** Cumulative inscribed radius from the bit (outer → inner) */
function computeRadii(): Map<PolygonName, number> {
  const radii = new Map<PolygonName, number>();
  let r = 1.0;  // start at the bit boundary
  // Walk inward: circle → hexagon → pentagon → square → triangle
  for (let i = POLYGONS.length - 1; i >= 0; i--) {
    radii.set(POLYGONS[i].name, r);
    r *= POLYGONS[i].inscribedRatio;
  }
  return radii;
}

const RADII = computeRadii();

// ── Dense Layer ──────────────────────────────────────────────────────────

/** A single dense neural network layer (weight matrix + bias) */
interface DenseLayer {
  /** Weight matrix: weights[out][in] */
  weights: number[][];
  /** Bias per output neuron */
  biases: number[];
  /** Momentum for weights (same shape) */
  wMomentum: number[][];
  /** Momentum for biases */
  bMomentum: number[];
  /** Input size */
  inputSize: number;
  /** Output size (= polygon neuron count) */
  outputSize: number;
  /** Polygon this layer belongs to */
  polygon: PolygonName;
  /** Last activations (for backprop) */
  lastInput: number[];
  lastPreAct: number[];
  lastOutput: number[];
}

function createDenseLayer(inputSize: number, outputSize: number, polygon: PolygonName): DenseLayer {
  // Xavier initialization
  const scale = Math.sqrt(6 / (inputSize + outputSize));
  const radius = RADII.get(polygon) ?? 1;

  const weights: number[][] = [];
  const wMomentum: number[][] = [];
  for (let o = 0; o < outputSize; o++) {
    const row: number[] = [];
    const mRow: number[] = [];
    for (let i = 0; i < inputSize; i++) {
      // Scale by inscribed radius — inner polygons have tighter weights
      row.push((Math.random() * 2 - 1) * scale * radius);
      mRow.push(0);
    }
    weights.push(row);
    wMomentum.push(mRow);
  }

  // Bias: spread evenly across the polygon's angular positions
  const biases: number[] = [];
  for (let o = 0; o < outputSize; o++) {
    // Each neuron sits at a different angle on the polygon
    const angle = (2 * Math.PI * o) / outputSize;
    biases.push(Math.sin(angle) * 0.1 * radius);
  }

  return {
    weights,
    biases,
    wMomentum,
    bMomentum: new Array(outputSize).fill(0),
    inputSize,
    outputSize,
    polygon,
    lastInput: [],
    lastPreAct: [],
    lastOutput: [],
  };
}

// ── Activation Functions ─────────────────────────────────────────────────

/** Each polygon has a distinct activation:
 *  Triangle: sigmoid (binary gate, IS/ISN'T)
 *  Square: tanh (symmetric, 4 quadrants of the observer)
 *  Pentagon: φ-sigmoid (aperiodic — the golden gate)
 *  Hexagon: tanh (symmetric pattern memory)
 *  Circle: bounded linear (continuous output, no squashing)
 */
function activate(x: number, polygon: PolygonName): number {
  switch (polygon) {
    case "triangle":
      return 1 / (1 + Math.exp(-x));                    // sigmoid [0,1]
    case "square":
      return Math.tanh(x);                               // tanh [-1,1]
    case "pentagon":
      return 1 / (1 + Math.exp(-x / PHI));              // φ-sigmoid [0,1]
    case "hexagon":
      return Math.tanh(x);                               // tanh [-1,1]
    case "circle":
      return Math.tanh(x * COLONY_SHARE);               // soft linear [-1,1]
  }
}

function activateDerivative(output: number, polygon: PolygonName): number {
  switch (polygon) {
    case "triangle":
      return output * (1 - output);                      // sigmoid'
    case "square":
      return 1 - output * output;                        // tanh'
    case "pentagon":
      return output * (1 - output) / PHI;                // φ-sigmoid'
    case "hexagon":
      return 1 - output * output;                        // tanh'
    case "circle":
      return COLONY_SHARE * (1 - output * output);       // soft tanh'
  }
}

// ── Forward through a single layer ───────────────────────────────────────

function forwardLayer(layer: DenseLayer, input: number[]): number[] {
  layer.lastInput = [...input];
  const output: number[] = [];
  const preAct: number[] = [];

  for (let o = 0; o < layer.outputSize; o++) {
    let sum = layer.biases[o];
    for (let i = 0; i < layer.inputSize; i++) {
      sum += (input[i] ?? 0) * layer.weights[o][i];
    }
    preAct.push(sum);
    output.push(activate(sum, layer.polygon));
  }

  layer.lastPreAct = preAct;
  layer.lastOutput = output;
  return output;
}

// ── The Polygon Model ────────────────────────────────────────────────────

export class PolygonModel {
  /** Generation path: △(3) → □(4) → ⬠(5) → ⬡(6) → ○(N) */
  private genLayers: DenseLayer[];
  /** Deconstruction path: ○(6) → ⬡(5) → ⬠(4) → □(3) → ▽(2) */
  private decLayers: DenseLayer[];

  /** Total learnable parameters */
  readonly parameterCount: number;
  /** Circle neuron count (scales with drive space) */
  readonly circleNeurons: number;
  /** Number of hex cells backing the model */
  readonly backingCells: number;

  constructor(options: {
    circleNeurons?: number;   // default 7 (spectrum)
    backingCells?: number;    // hex cells from drive, for stats
  } = {}) {
    this.circleNeurons = options.circleNeurons ?? 7;
    this.backingCells = options.backingCells ?? 0;

    const N = this.circleNeurons;

    // Generation path (center → outer): input(2) → △(3) → □(4) → ⬠(5) → ⬡(6) → ○(N)
    this.genLayers = [
      createDenseLayer(2, 3, "triangle"),   // seed → triangle
      createDenseLayer(3, 4, "square"),      // triangle → square
      createDenseLayer(4, 5, "pentagon"),    // square → pentagon (φ gate)
      createDenseLayer(5, 6, "hexagon"),     // pentagon → hexagon
      createDenseLayer(6, N, "circle"),      // hexagon → circle (output)
    ];

    // Deconstruction path (outer → center): input(N) → ○(6) → ⬡(5) → ⬠(4) → □(3) → ▽(2)
    this.decLayers = [
      createDenseLayer(N, 6, "circle"),      // spectrum → circle
      createDenseLayer(6, 5, "hexagon"),     // circle → hexagon
      createDenseLayer(5, 4, "pentagon"),    // hexagon → pentagon (φ gate)
      createDenseLayer(4, 3, "square"),      // pentagon → square
      createDenseLayer(3, 2, "triangle"),    // square → triangle (IS/ISN'T)
    ];

    // Count parameters
    let params = 0;
    for (const layer of [...this.genLayers, ...this.decLayers]) {
      params += layer.inputSize * layer.outputSize + layer.outputSize;
    }
    this.parameterCount = params;
  }

  // ── Forward Pass ─────────────────────────────────────────────────────

  forward(input: number[], direction: "generate" | "deconstruct"): {
    output: number[];
    layerOutputs: number[][];
  } {
    const layers = direction === "generate" ? this.genLayers : this.decLayers;
    const layerOutputs: number[][] = [];
    let signal = [...input];

    for (const layer of layers) {
      signal = forwardLayer(layer, signal);
      layerOutputs.push([...signal]);
    }

    return { output: signal, layerOutputs };
  }

  // ── Backward Pass ────────────────────────────────────────────────────

  backward(
    target: number[],
    output: number[],
    direction: "generate" | "deconstruct",
    learningRate: number = 0.3,
  ): { totalError: number; avgGradient: number } {
    const layers = direction === "generate" ? this.genLayers : this.decLayers;

    // Compute output error
    const n = Math.min(target.length, output.length);
    let mse = 0;
    let errorSignal: number[] = [];
    for (let i = 0; i < n; i++) {
      const e = target[i] - output[i];
      errorSignal.push(e);
      mse += e * e;
    }
    const totalError = Math.sqrt(mse / n);

    // Boltzmann learning schedule
    const boltzmann = Math.exp(-totalError / COLONY_SHARE);
    const updateScale = (1 - boltzmann) + 0.01;
    const effectiveLR = learningRate * updateScale;

    let gradientSum = 0;
    let gradientCount = 0;

    // Backpropagate through layers in reverse
    // Inner polygons (smaller radius) get HIGHER learning rate
    // to compensate for vanishing gradients through 5 layers
    for (let l = layers.length - 1; l >= 0; l--) {
      const layer = layers[l];
      const out = layer.lastOutput;
      const radius = RADII.get(layer.polygon) ?? 1;
      // Depth-compensated LR: inner layers get up to 1/radius boost
      const depthLR = effectiveLR / Math.max(radius, 0.1);

      // Compute deltas: δ = error × f'(output)
      const deltas: number[] = [];
      for (let o = 0; o < layer.outputSize; o++) {
        const dAct = activateDerivative(out[o] ?? 0, layer.polygon);
        deltas.push((errorSignal[o] ?? 0) * dAct);
      }

      // Compute error for previous layer: sum(δ × W) for each input
      const prevError = new Array(layer.inputSize).fill(0);
      for (let o = 0; o < layer.outputSize; o++) {
        for (let i = 0; i < layer.inputSize; i++) {
          prevError[i] += deltas[o] * layer.weights[o][i];
        }
      }

      // Update weights: Δw = lr × δ × input (standard momentum SGD)
      for (let o = 0; o < layer.outputSize; o++) {
        for (let i = 0; i < layer.inputSize; i++) {
          const grad = deltas[o] * (layer.lastInput[i] ?? 0);
          layer.wMomentum[o][i] = 0.9 * layer.wMomentum[o][i] + grad;
          layer.weights[o][i] += depthLR * layer.wMomentum[o][i];
          gradientSum += Math.abs(grad);
          gradientCount++;
        }
        layer.bMomentum[o] = 0.9 * layer.bMomentum[o] + deltas[o];
        layer.biases[o] += depthLR * layer.bMomentum[o];
      }

      errorSignal = prevError;
    }

    return {
      totalError,
      avgGradient: gradientCount > 0 ? gradientSum / gradientCount : 0,
    };
  }

  // ── Training ─────────────────────────────────────────────────────────

  train(examples: Array<{
    input: number[];
    target: number[];
    direction: "generate" | "deconstruct";
  }>, learningRate: number = 0.3): {
    avgError: number;
    convergence: number;
  } {
    let totalError = 0;

    for (const ex of examples) {
      const fwd = this.forward(ex.input, ex.direction);
      const bwd = this.backward(ex.target, fwd.output, ex.direction, learningRate);
      totalError += bwd.totalError;
    }

    const avgError = examples.length > 0 ? totalError / examples.length : 0;
    return {
      avgError,
      convergence: Math.exp(-avgError),
    };
  }

  // ── Generate ─────────────────────────────────────────────────────────

  generate(seed: [number, number]): {
    spectrum: number[];
    dominantColor: number;
    confidence: number;
  } {
    const result = this.forward(seed, "generate");
    const spectrum = result.output;

    let maxVal = -Infinity, maxIdx = 0;
    for (let i = 0; i < spectrum.length; i++) {
      if (spectrum[i] > maxVal) { maxVal = spectrum[i]; maxIdx = i; }
    }

    const sum = spectrum.reduce((s, v) => s + Math.abs(v), 0) || 1;
    return {
      spectrum,
      dominantColor: maxIdx,
      confidence: Math.abs(maxVal) / sum,
    };
  }

  // ── Deconstruct ──────────────────────────────────────────────────────

  deconstruct(spectrum: number[]): {
    is: number;
    isnt: number;
    verdict: "IS" | "ISNT" | "UNCERTAIN";
    confidence: number;
  } {
    const result = this.forward(spectrum, "deconstruct");
    const [isVal, isntVal] = result.output;

    const total = Math.abs(isVal) + Math.abs(isntVal) || 1;
    const isNorm = Math.abs(isVal) / total;
    const isntNorm = Math.abs(isntVal) / total;

    return {
      is: isNorm,
      isnt: isntNorm,
      verdict: isNorm > 0.6 ? "IS" : isntNorm > 0.6 ? "ISNT" : "UNCERTAIN",
      confidence: Math.abs(isNorm - isntNorm),
    };
  }

  // ── Stats ────────────────────────────────────────────────────────────

  stats(): {
    parameterCount: number;
    circleNeurons: number;
    totalNeurons: number;
    layerSizes: { gen: string; dec: string };
    estimatedSizeBytes: number;
  } {
    const genSizes = this.genLayers.map(l => l.outputSize);
    const decSizes = this.decLayers.map(l => l.outputSize);
    const totalNeurons = 3 + 4 + 5 + 6 + this.circleNeurons;  // gen path
    // + 6 + 5 + 4 + 3 + 2 for dec path (separate weights)

    return {
      parameterCount: this.parameterCount,
      circleNeurons: this.circleNeurons,
      totalNeurons,
      layerSizes: {
        gen: `2 → ${genSizes.join(" → ")}`,
        dec: `${this.circleNeurons} → ${decSizes.join(" → ")}`,
      },
      estimatedSizeBytes: this.parameterCount * 32,
    };
  }
}

// ── Demo ──────────────────────────────────────────────────────────────────

function fmt(n: number, d: number = 2): string { return n.toFixed(d); }

export function runPolygonDemo(options: {
  verbose?: boolean;
  trainingRounds?: number;
  circleNeurons?: number;
} = {}): {
  model: PolygonModel;
  finalError: number;
  convergence: number;
} {
  const verbose = options.verbose ?? true;
  const rounds = options.trainingRounds ?? 300;
  const circleN = options.circleNeurons ?? 7;

  if (verbose) {
    console.log("POLYGON MODEL — Nested Shapes Inside a Bit");
    console.log("═".repeat(70));
    console.log();
  }

  const model = new PolygonModel({ circleNeurons: circleN });
  const s = model.stats();

  if (verbose) {
    console.log("  THE BIT (container):");
    console.log("  0 ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━● 1");
    console.log();
    console.log("  NESTED POLYGONS (each inscribed in the previous):");
    console.log("  " + "─".repeat(66));

    const radii = computeRadii();
    for (let i = POLYGONS.length - 1; i >= 0; i--) {
      const p = POLYGONS[i];
      const r = radii.get(p.name) ?? 0;
      const tileStr = p.tiles ? "tiles" : "APERIODIC";
      const sides = p.sides === 0 ? "∞" : String(p.sides);
      console.log(
        `    ${p.symbol} ${p.name.padEnd(10)} ${sides.padStart(2)} sides  ` +
        `r=${fmt(r, 3)}  ${p.neurons} neurons  ${tileStr}`
      );
    }

    console.log();
    console.log(`  ARCHITECTURE:`);
    console.log(`    Generation △ :  ${s.layerSizes.gen}`);
    console.log(`    Deconstruct ▽:  ${s.layerSizes.dec}`);
    console.log(`    Parameters:     ${s.parameterCount}`);
    console.log(`    Size:           ${(s.estimatedSizeBytes / 1024).toFixed(1)}KB`);
    console.log();
    console.log("  KEY INSIGHT:");
    console.log("    3,4,6 TILE the plane — structured, deterministic, repeatable");
    console.log("    5,∞ do NOT tile — aperiodic, non-repeating, creative");
    console.log("    The pentagon (⬠) is the φ boundary between order and chaos");
    console.log("    Two triangles (△▽) interlock as a hexagram — separate paths");
    console.log();
  }

  // ── Training ──────────────────────────────────────────────────────

  if (verbose) {
    console.log("  TRAINING:");
    console.log("  " + "─".repeat(66));
  }

  const examples = [
    // Generation: IS signal → warm spectrum (red/orange dominant)
    { input: [0.9, 0.1], target: [0.8, 0.6, 0.5, 0.2, 0.1, 0.1, 0.05], direction: "generate" as const },
    // Generation: ISN'T signal → cool spectrum (blue/violet dominant)
    { input: [0.1, 0.9], target: [0.05, 0.1, 0.1, 0.2, 0.5, 0.6, 0.8], direction: "generate" as const },
    // Generation: balanced → green-centered
    { input: [0.5, 0.5], target: [0.2, 0.3, 0.4, 0.8, 0.4, 0.3, 0.2], direction: "generate" as const },
    // Deconstruction: warm → IS
    { input: [0.8, 0.6, 0.5, 0.2, 0.1, 0.1, 0.05], target: [0.9, 0.1], direction: "deconstruct" as const },
    // Deconstruction: cool → ISN'T
    { input: [0.05, 0.1, 0.1, 0.2, 0.5, 0.6, 0.8], target: [0.1, 0.9], direction: "deconstruct" as const },
    // Deconstruction: balanced → uncertain
    { input: [0.3, 0.3, 0.4, 0.8, 0.4, 0.3, 0.3], target: [0.5, 0.5], direction: "deconstruct" as const },
  ];

  let lastResult = { avgError: 1, convergence: 0 };

  for (let round = 0; round < rounds; round++) {
    lastResult = model.train(examples, 0.5);

    if (verbose && (
      round === 0 || round === 4 || round === 9 || round === 24 ||
      round === 49 || round === 99 || round === 199 || round === rounds - 1
    )) {
      console.log(
        `    Round ${String(round + 1).padStart(4)}: ` +
        `error=${fmt(lastResult.avgError, 4)} ` +
        `convergence=${fmt(lastResult.convergence * 100, 1)}%`
      );
    }
  }

  // ── Inference ──────────────────────────────────────────────────────

  if (verbose) {
    console.log();
    console.log("  GENERATION △ (seed → spectrum):");
    console.log("  " + "─".repeat(66));

    const colors = ["R", "O", "Y", "G", "C", "B", "V"];
    for (const seed of [[0.9, 0.1], [0.1, 0.9], [0.5, 0.5], [0.7, 0.3]] as [number, number][]) {
      const gen = model.generate(seed);
      const specStr = gen.spectrum.map((v, i) => `${colors[i]}=${fmt(v, 2)}`).join(" ");
      console.log(
        `    [${fmt(seed[0], 1)},${fmt(seed[1], 1)}] → ${specStr}` +
        `  peak=${colors[gen.dominantColor]} conf=${fmt(gen.confidence * 100, 0)}%`
      );
    }

    console.log();
    console.log("  DECONSTRUCTION ▽ (spectrum → IS/ISN'T):");
    console.log("  " + "─".repeat(66));

    const tests = [
      { label: "warm",     values: [0.8, 0.7, 0.5, 0.2, 0.1, 0.1, 0.05] },
      { label: "cool",     values: [0.05, 0.1, 0.1, 0.2, 0.5, 0.7, 0.8] },
      { label: "balanced", values: [0.3, 0.3, 0.4, 0.8, 0.4, 0.3, 0.3] },
      { label: "noise",    values: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
    ];

    for (const test of tests) {
      const dec = model.deconstruct(test.values);
      console.log(
        `    ${test.label.padEnd(10)} → IS=${fmt(dec.is * 100, 0)}% ISN'T=${fmt(dec.isnt * 100, 0)}% ` +
        `verdict=${dec.verdict.padEnd(10)} conf=${fmt(dec.confidence * 100, 0)}%`
      );
    }

    // ── Scaling table ──────────────────────────────────────────────

    console.log();
    console.log("  SCALING (circle neurons grow with drive space):");
    console.log("  " + "─".repeat(66));
    for (const [label, cn] of [["64GB", 7], ["256GB", 14], ["931GB", 49], ["2TB", 98], ["10TB", 490]] as const) {
      const m = new PolygonModel({ circleNeurons: cn });
      const ms = m.stats();
      console.log(
        `    ${label.padEnd(6)} ○=${String(cn).padStart(3)} neurons  ` +
        `${String(ms.parameterCount).padStart(6)} params  ` +
        `${(ms.estimatedSizeBytes / 1024).toFixed(1).padStart(7)}KB`
      );
    }

    console.log();
    console.log("  THE ARCHITECTURE:");
    console.log(`    1 bit = line from 0 to 1 = the container`);
    console.log(`    Inside: ○ circle → ⬡ hexagon → ⬠ pentagon → □ square → △▽ triangles`);
    console.log(`    Each inscribed in the last. The gaps between shapes = activation zones.`);
    console.log(`    △ UP = generation (IS/ISN'T → spectrum). ▽ DOWN = deconstruction.`);
    console.log(`    The pentagon DOESN'T TILE — it's the φ boundary where order meets chaos.`);
    console.log(`    More drive space → bigger circle → same polygons, finer resolution.`);
    console.log();
  }

  return {
    model,
    finalError: lastResult.avgError,
    convergence: lastResult.convergence,
  };
}
