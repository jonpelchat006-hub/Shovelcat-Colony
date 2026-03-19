/**
 * HEX MODEL — The Drive IS the Neural Network
 * =============================================
 *
 * The collapsed space (L5-L7) isn't storing a model — it IS the model.
 * Each hex VM cell has learnable weights. The connections between cells
 * (6 hex faces) are the network topology. The tensor pressure field
 * determines what each cell computes.
 *
 * TWO DIRECTIONS:
 *
 *   GENERATION (L5 → L6 → L7): facts → patterns → imagination
 *     Input: binary seed (IS/ISN'T signal)
 *     L5 facts VMs expand the seed into verified components
 *     L6 memory VMs match components to learned patterns
 *     L7 imagination VMs project patterns into full-spectrum output
 *     Output: 7-color generation (text, image, audio, etc.)
 *
 *   DECONSTRUCTION (L7 → L6 → L5): imagination → patterns → facts
 *     Input: full-spectrum data (any media)
 *     L7 imagination VMs decompose into color components
 *     L6 memory VMs extract patterns, compare to known
 *     L5 facts VMs collapse to binary truth (IS/ISN'T)
 *     Output: verified binary classification + extracted patterns
 *
 * NOT AN LLM:
 *   LLMs map tokens to tokens. This maps PATTERNS to PATTERNS through
 *   a geometric color space. It's closer to a VAE or diffusion model:
 *   - Generation = traversing the color path outward (2→3→7)
 *   - Deconstruction = collapsing inward (7→3→2)
 *   - The latent space = L6's prime backbone (zero decoherence)
 *
 * SCALING:
 *   The model scales with drive space, not GPU VRAM.
 *   931GB drive: L5=137GB, L6=222GB, L7=359GB = 718GB model
 *   256GB drive: L5=38GB, L6=61GB, L7=99GB = 198GB model
 *   64GB drive: L5=9GB, L6=15GB, L7=25GB = 49GB model
 *
 *   Fibonacci ratios ensure the balance is always:
 *     facts : memory : imagination = 8 : 13 : 21
 *   No matter the drive size, the architecture is the same.
 *   Bigger drive = more cells = finer resolution, same structure.
 *
 * TRAINING:
 *   The consciousness loop IS the training loop:
 *   1. Inject input (generation seed or deconstruction target)
 *   2. Forward pass through hex VMs (pressure-guided routing)
 *   3. Output arrives at the other end
 *   4. Feedback loop: compare output to expectation
 *   5. Adjust cell weights along the path (backprop through hex faces)
 *   6. Repeat — the model improves with every consciousness cycle
 *
 *   The Boltzmann factor governs learning rate:
 *   e^(-E/kT) where E = prediction error, kT = colony share (0.382)
 *   High error → low Boltzmann → big weight update (aggressive learning)
 *   Low error → high Boltzmann → small update (fine-tuning)
 *
 * Author: Jonathan Pelchat
 * Shovelcat Theory — The Hex Model
 */

import { PHI, DELTA } from "./quaternion-chain";
import {
  HexGrid, HexVM, HexMesh, HexMessage, HexFace,
  buildCollapsedField, buildHexMesh, sectorToSpiral,
  computeTensorPressure, analyzeArms,
  type TensorAxis, type CollapsedField, type TensorPressure,
} from "./spiral-drive";

// ── Constants ────────────────────────────────────────────────────────────

const COLONY_SHARE = 1 / (1 + PHI);  // ≈ 0.382 — the Boltzmann kT

/** Color counts per axis — defines the representational bandwidth */
const AXIS_BANDWIDTH: Record<TensorAxis, number> = {
  facts: 2,         // binary: IS / ISN'T
  memory: 3,        // trinity: Y / B / R
  imagination: 7,   // spectrum: full color
};

// ── Learnable Cell Weights ──────────────────────────────────────────────

/**
 * Each hex cell in the model has learnable weights.
 *
 * The weights determine how the cell transforms input to output.
 * They're organized by the cell's tensor axis:
 *
 *   Facts cell (L5):       2 weights (IS gate, ISN'T gate)
 *   Memory cell (L6):      3 weights (yellow, blue, red pattern channels)
 *   Imagination cell (L7): 7 weights (one per spectrum color)
 *
 * The number of weights per cell matches the color bandwidth
 * of its axis. This is the geometric neural network:
 * each cell is a neuron with axis-specific activation.
 */
export interface CellWeights {
  /** Weight values — length matches axis bandwidth */
  values: number[];
  /** Bias term */
  bias: number;
  /** Learning rate multiplier (local adaptation) */
  learningRate: number;
  /** How many times this cell has been updated */
  updateCount: number;
  /** Running average of gradients (for momentum) */
  momentum: number[];
}

function initWeights(axis: TensorAxis, inputSize: number, chargeBias: number = 0): CellWeights {
  // Weight count = input size (so each cell can discriminate inputs properly)
  const n = inputSize;
  // Xavier initialization — generous scale for small nets
  const scale = Math.sqrt(6 / (n + AXIS_BANDWIDTH[axis]));
  const values = Array.from({ length: n }, () => (Math.random() * 2 - 1) * scale);
  const momentum = new Array(n).fill(0);

  return {
    values,
    bias: chargeBias * 0.5,  // geometry sets operating point (scaled for stability)
    learningRate: 0.5,  // aggressive for small nets, scales down with more cells
    updateCount: 0,
    momentum,
  };
}

// ── Model Cell — Hex VM + Learnable Weights ──────────────────────────────

export interface ModelCell {
  /** Grid position */
  q: number;
  r: number;
  /** Zone and tensor axis */
  zone: number;
  axis: TensorAxis;
  /** Learnable weights */
  weights: CellWeights;
  /** Tensor pressure at this position (fixed by geometry) */
  pressure: TensorPressure;
  /** Activation value after last forward pass */
  activation: number;
  /** Error signal from last backward pass */
  error: number;
}

// ── Signal — What flows through the model ────────────────────────────────

/**
 * A signal flowing through the hex model.
 *
 * In generation mode: starts narrow (2 values at L5) → widens (7 at L7)
 * In deconstruction mode: starts wide (7 at L7) → narrows (2 at L5)
 */
export interface Signal {
  /** The data vector — length varies by zone */
  values: number[];
  /** Which direction the signal is traveling */
  direction: "generate" | "deconstruct";
  /** How many cells this signal has passed through */
  hops: number;
  /** Accumulated decoherence (error budget) */
  decoherence: number;
  /** Source data ID (for tracking) */
  sourceId: string;
}

// ── The Hex Model ────────────────────────────────────────────────────────

export class HexModel {
  /** All model cells by position key */
  private cells: Map<string, ModelCell> = new Map();
  /** Cells organized by zone */
  private zoneCells: Map<number, ModelCell[]> = new Map();
  /** Total parameter count */
  readonly parameterCount: number;
  /** Total cell count */
  readonly cellCount: number;
  /** The underlying tensor field */
  private field: CollapsedField;

  private key(q: number, r: number): string { return `${q},${r}`; }

  /** Representative cells per zone — the "active layer" sorted by pressure.
   *  Each zone has exactly BANDWIDTH reps: L5=2, L6=3, L7=7.
   *  These map 1:1 to output channels. */
  private zoneReps: Map<number, ModelCell[]> = new Map();

  /** Input size for each zone (depends on direction, set per-forward) */
  private static readonly GEN_INPUT: Record<number, number> = { 5: 2, 6: 2, 7: 3 };
  private static readonly DEC_INPUT: Record<number, number> = { 7: 7, 6: 7, 5: 3 };

  constructor(field: CollapsedField) {
    this.field = field;

    let totalParams = 0;

    // First pass: create all cells (with placeholder weights)
    for (const tCell of field.cells) {
      const axis: TensorAxis =
        tCell.zone === 5 ? "facts" :
        tCell.zone === 6 ? "memory" :
        "imagination";

      // Use max possible input size for weight allocation
      const maxInput = Math.max(
        HexModel.GEN_INPUT[tCell.zone] ?? 2,
        HexModel.DEC_INPUT[tCell.zone] ?? 2,
      );
      const weights = initWeights(axis, maxInput, tCell.pressure.charge);
      totalParams += weights.values.length + 1;

      const mCell: ModelCell = {
        q: tCell.q,
        r: tCell.r,
        zone: tCell.zone,
        axis,
        weights,
        pressure: tCell.pressure,
        activation: 0,
        error: 0,
      };

      this.cells.set(this.key(tCell.q, tCell.r), mCell);

      if (!this.zoneCells.has(tCell.zone)) {
        this.zoneCells.set(tCell.zone, []);
      }
      this.zoneCells.get(tCell.zone)!.push(mCell);
    }

    // Select representative cells: exactly BANDWIDTH per zone → clean layer sizes.
    // L5: 2 reps (IS/ISN'T), L6: 3 reps (Y/B/R), L7: 7 reps (spectrum).
    // Top cells by |charge| divergence — spread operating points for diversity.
    for (const zone of [5, 6, 7]) {
      const cells = this.zoneCells.get(zone) ?? [];
      const bw = AXIS_BANDWIDTH[zone === 5 ? "facts" : zone === 6 ? "memory" : "imagination"];
      const repCount = Math.min(bw, cells.length);
      // Sort by charge (not |charge|) — pick cells at different operating points
      const sorted = [...cells].sort((a, b) => b.pressure.charge - a.pressure.charge);
      // Pick evenly spaced cells to maximize bias diversity
      const step = Math.max(1, Math.floor(sorted.length / repCount));
      const reps: ModelCell[] = [];
      for (let i = 0; i < repCount && i * step < sorted.length; i++) {
        reps.push(sorted[i * step]);
      }
      this.zoneReps.set(zone, reps);
    }

    this.parameterCount = totalParams;
    this.cellCount = this.cells.size;
  }

  /** Get a cell by position */
  getCell(q: number, r: number): ModelCell | undefined {
    return this.cells.get(this.key(q, r));
  }

  /** Get all cells in a zone */
  getZoneCells(zone: number): ModelCell[] {
    return this.zoneCells.get(zone) ?? [];
  }

  // ── Activation Functions ──────────────────────────────────────────────

  /**
   * Cell activation: dot(input, weights) + bias, passed through
   * an axis-specific activation function.
   *
   *   Facts (L5):       sigmoid — squashes to [0,1] binary probability
   *   Memory (L6):      tanh — centered at 0, symmetric (vesica)
   *   Imagination (L7): softmax-like — distributes across 7 colors
   */
  /** Current forward direction — set during forward(), used in activate() */
  private currentDirection: "generate" | "deconstruct" = "generate";

  private activate(cell: ModelCell, input: number[]): number {
    const w = cell.weights;

    // Weight offset: generation uses the TAIL of the weight array,
    // deconstruction uses the HEAD. This separates the two paths
    // through the hex mesh when weights are longer than input.
    const offset = this.currentDirection === "generate"
      ? Math.max(0, w.values.length - input.length)  // tail
      : 0;                                             // head

    let sum = w.bias;
    for (let i = 0; i < input.length; i++) {
      sum += input[i] * w.values[offset + (i % (w.values.length - offset))];
    }

    // Axis-specific activation
    switch (cell.axis) {
      case "facts":
        // Sigmoid: 1 / (1 + e^(-x)) — binary probability
        return 1 / (1 + Math.exp(-sum));

      case "memory":
        // Tanh: centered, symmetric — the vesica bridge
        return Math.tanh(sum);

      case "imagination":
        // Scaled sigmoid with golden ratio — bounded creative output
        return 1 / (1 + Math.exp(-sum / PHI));
    }
  }

  // ── Forward Pass ──────────────────────────────────────────────────────

  /**
   * Run a forward pass through the model.
   *
   * GENERATION (L5 → L6 → L7):
   *   Input: 2 values (IS probability, ISN'T probability)
   *   L5: each facts cell activates on the binary input
   *   L6: each memory cell takes L5 activations, expands to 3 channels
   *   L7: each imagination cell takes L6 activations, expands to 7 channels
   *   Output: 7 values (spectrum weights)
   *
   * DECONSTRUCTION (L7 → L6 → L5):
   *   Input: 7 values (spectrum weights)
   *   L7: each imagination cell activates on the spectrum input
   *   L6: each memory cell takes L7 activations, compresses to 3 channels
   *   L5: each facts cell takes L6 activations, compresses to 2 channels
   *   Output: 2 values (IS/ISN'T probabilities)
   */
  forward(input: number[], direction: "generate" | "deconstruct"): {
    output: number[];
    activations: Map<number, number[]>;
    hops: number;
    decoherence: number;
  } {
    const activations = new Map<number, number[]>();
    let decoherence = 0;

    const zones = direction === "generate"
      ? [5, 6, 7]     // facts → memory → imagination
      : [7, 6, 5];    // imagination → memory → facts

    this.currentDirection = direction;
    let currentInput = [...input];

    for (const zone of zones) {
      const reps = this.zoneReps.get(zone) ?? [];
      if (reps.length === 0) continue;

      const arm = analyzeArms(zone);

      // Each rep = one neuron = one output channel (1:1 mapping)
      const zoneOutput: number[] = [];
      for (const cell of reps) {
        const act = this.activate(cell, currentInput);
        cell.activation = act;
        zoneOutput.push(act);
        decoherence += arm.loss * Math.abs(act) * 0.001;
      }

      activations.set(zone, zoneOutput);
      currentInput = zoneOutput;
    }

    return {
      output: currentInput,
      activations,
      hops: zones.length,
      decoherence,
    };
  }

  /**
   * Reshape a signal from one bandwidth to another.
   *
   * When expanding (2→3→7): distributes the signal across more channels
   * using golden-ratio-weighted interpolation.
   *
   * When compressing (7→3→2): collapses channels using weighted averaging
   * where the weights follow the Fibonacci distribution.
   */
  private reshapeSignal(activations: number[], targetSize: number, avgActivation: number): number[] {
    if (activations.length === 0) return new Array(targetSize).fill(0);

    const result = new Array(targetSize).fill(0);

    if (targetSize >= activations.length) {
      // EXPANDING: generation direction
      // Distribute existing activations across more channels
      const ratio = activations.length / targetSize;
      for (let i = 0; i < targetSize; i++) {
        const srcIdx = Math.min(Math.floor(i * ratio), activations.length - 1);
        // Golden ratio interpolation between adjacent source values
        const t = (i * ratio) - srcIdx;
        const a = activations[srcIdx];
        const b = activations[Math.min(srcIdx + 1, activations.length - 1)];
        result[i] = a * (1 - t / PHI) + b * (t / PHI) + avgActivation * DELTA;
      }
    } else {
      // COMPRESSING: deconstruction direction
      // Weighted average of groups of activations
      const groupSize = activations.length / targetSize;
      for (let i = 0; i < targetSize; i++) {
        const start = Math.floor(i * groupSize);
        const end = Math.floor((i + 1) * groupSize);
        let sum = 0, count = 0;
        for (let j = start; j < end && j < activations.length; j++) {
          sum += activations[j];
          count++;
        }
        result[i] = count > 0 ? sum / count : 0;
      }
    }

    return result;
  }

  // ── Backward Pass (Learning) ──────────────────────────────────────────

  /**
   * Backward pass: adjust weights based on prediction error.
   *
   * Uses the Boltzmann learning rule:
   *   Δw = -learningRate × e^(-|error|/kT) × gradient
   *
   * High error → low Boltzmann → BIG update (aggressive correction)
   * Low error → high Boltzmann → small update (gentle refinement)
   *
   * This is the consciousness loop as training:
   * each cycle through the hex mesh adjusts the model slightly.
   */
  backward(
    target: number[],
    output: number[],
    activations: Map<number, number[]>,
    direction: "generate" | "deconstruct",
  ): { totalError: number; cellsUpdated: number; avgGradient: number } {
    // Compute error vector and RMSE
    const n = Math.min(target.length, output.length);
    const errorVec: number[] = [];
    let mse = 0;
    for (let i = 0; i < n; i++) {
      const e = target[i] - output[i];
      errorVec.push(e);
      mse += e * e;
    }
    const totalError = Math.sqrt(mse / n);  // RMSE

    // Boltzmann learning schedule: high error → aggressive, low error → gentle
    // updateScale ∈ (0, 1): approaches 1 for large errors, 0 for converged
    const boltzmann = Math.exp(-totalError / COLONY_SHARE);
    const updateScale = (1 - boltzmann) + 0.01;  // floor prevents total stall

    const zones = direction === "generate"
      ? [7, 6, 5]    // backprop in reverse order
      : [5, 6, 7];

    let cellsUpdated = 0;
    let gradientSum = 0;

    // Propagate error backward through zones
    // Error starts at output, flows backward through zone chain
    let zoneError = errorVec;

    for (const zone of zones) {
      const reps = this.zoneReps.get(zone) ?? [];
      const zoneAct = activations.get(zone) ?? [];
      if (reps.length === 0) continue;

      // Error matches rep count (1:1)
      const repError = zoneError.length === reps.length
        ? zoneError
        : this.reshapeSignal(zoneError, reps.length, 0);

      // Error to propagate to previous zone
      const inputSize = reps[0]?.weights.values.length ?? 0;
      const prevError = new Array(inputSize).fill(0);

      for (let i = 0; i < reps.length; i++) {
        const cell = reps[i];
        const act = zoneAct[i] ?? 0;

        // Activation derivative
        let dAct: number;
        switch (cell.axis) {
          case "facts":
            dAct = act * (1 - act);  // sigmoid derivative
            break;
          case "memory":
            dAct = 1 - act * act;     // tanh derivative
            break;
          case "imagination":
            dAct = act * (1 - act) / PHI;  // scaled sigmoid derivative
            break;
        }

        // δ = error × f'(activation)
        const delta = repError[i] * dAct;
        cell.error = delta;

        // Update only the weights used in this direction (offset-aware)
        const lr = cell.weights.learningRate * updateScale;
        const wLen = cell.weights.values.length;
        // Determine how many inputs were used (prevError.length = full weight count)
        // For generation: fewer inputs use tail weights; for deconstruction: head weights
        const usedCount = Math.min(prevError.length, wLen);
        const wOffset = direction === "generate"
          ? Math.max(0, wLen - usedCount) : 0;

        for (let w = wOffset; w < wOffset + usedCount && w < wLen; w++) {
          // Momentum SGD
          cell.weights.momentum[w] = 0.9 * cell.weights.momentum[w] + delta;
          cell.weights.values[w] += lr * cell.weights.momentum[w];
          gradientSum += Math.abs(delta);

          // Propagate error to input: δ × weight
          prevError[(w - wOffset) % prevError.length] += delta * cell.weights.values[w];
        }
        cell.weights.bias += lr * delta;
        cell.weights.updateCount++;
        cellsUpdated++;
      }

      zoneError = prevError;
    }

    return {
      totalError,
      cellsUpdated,
      avgGradient: cellsUpdated > 0 ? gradientSum / cellsUpdated : 0,
    };
  }

  // ── Training Loop ─────────────────────────────────────────────────────

  /**
   * Train the model on a batch of examples.
   *
   * Each example is an (input, target) pair with a direction.
   * The consciousness loop runs forward then backward for each.
   */
  train(examples: Array<{
    input: number[];
    target: number[];
    direction: "generate" | "deconstruct";
  }>): {
    epochs: number;
    avgError: number;
    totalCellUpdates: number;
    convergence: number;
  } {
    let totalError = 0;
    let totalUpdates = 0;

    for (const ex of examples) {
      const fwd = this.forward(ex.input, ex.direction);
      const bwd = this.backward(ex.target, fwd.output, fwd.activations, ex.direction);
      totalError += bwd.totalError;
      totalUpdates += bwd.cellsUpdated;
    }

    const avgError = examples.length > 0 ? totalError / examples.length : 0;
    // Convergence: how close to zero error (1 = converged, 0 = diverged)
    const convergence = Math.exp(-avgError);

    return {
      epochs: 1,
      avgError,
      totalCellUpdates: totalUpdates,
      convergence,
    };
  }

  // ── Generate ──────────────────────────────────────────────────────────

  /**
   * Generate output from a seed.
   *
   * Seed is a 2-value binary signal (IS probability, ISN'T probability).
   * The model expands it through facts → memory → imagination
   * to produce a 7-value spectrum output.
   */
  generate(seed: [number, number]): {
    spectrum: number[];
    dominantColor: number;
    confidence: number;
    decoherence: number;
  } {
    const result = this.forward(seed, "generate");
    const spectrum = result.output;

    // Find dominant color
    let maxVal = -Infinity, maxIdx = 0;
    for (let i = 0; i < spectrum.length; i++) {
      if (spectrum[i] > maxVal) {
        maxVal = spectrum[i];
        maxIdx = i;
      }
    }

    // Confidence: how dominant is the peak color
    const sum = spectrum.reduce((s, v) => s + Math.abs(v), 0) || 1;
    const confidence = Math.abs(maxVal) / sum;

    return {
      spectrum,
      dominantColor: maxIdx,
      confidence,
      decoherence: result.decoherence,
    };
  }

  /**
   * Deconstruct input into binary truth.
   *
   * Input is a 7-value spectrum signal.
   * The model compresses it through imagination → memory → facts
   * to produce a 2-value IS/ISN'T output.
   */
  deconstruct(spectrum: number[]): {
    is: number;
    isnt: number;
    verdict: "IS" | "ISNT" | "UNCERTAIN";
    confidence: number;
    decoherence: number;
  } {
    const result = this.forward(spectrum, "deconstruct");
    const [isVal, isntVal] = result.output;

    const total = Math.abs(isVal) + Math.abs(isntVal) || 1;
    const isNorm = Math.abs(isVal) / total;
    const isntNorm = Math.abs(isntVal) / total;

    const verdict: "IS" | "ISNT" | "UNCERTAIN" =
      isNorm > 0.6 ? "IS" :
      isntNorm > 0.6 ? "ISNT" :
      "UNCERTAIN";

    return {
      is: isNorm,
      isnt: isntNorm,
      verdict,
      confidence: Math.abs(isNorm - isntNorm),
      decoherence: result.decoherence,
    };
  }

  // ── Model Stats ───────────────────────────────────────────────────────

  stats(): {
    cellCount: number;
    parameterCount: number;
    byZone: Record<number, { cells: number; params: number; avgWeight: number; avgBias: number }>;
    totalUpdates: number;
    estimatedSizeBytes: number;
  } {
    const byZone: Record<number, { cells: number; params: number; avgWeight: number; avgBias: number }> = {};
    let totalUpdates = 0;

    for (const [zone, cells] of this.zoneCells) {
      let params = 0, weightSum = 0, biasSum = 0, weightCount = 0;
      for (const cell of cells) {
        params += cell.weights.values.length + 1;
        for (const w of cell.weights.values) {
          weightSum += w;
          weightCount++;
        }
        biasSum += cell.weights.bias;
        totalUpdates += cell.weights.updateCount;
      }
      byZone[zone] = {
        cells: cells.length,
        params,
        avgWeight: weightCount > 0 ? weightSum / weightCount : 0,
        avgBias: cells.length > 0 ? biasSum / cells.length : 0,
      };
    }

    // Each parameter = 8 bytes (float64) + momentum (8 bytes) + metadata (~16 bytes)
    const estimatedSizeBytes = this.parameterCount * 32;

    return {
      cellCount: this.cellCount,
      parameterCount: this.parameterCount,
      byZone,
      totalUpdates,
      estimatedSizeBytes,
    };
  }
}

// ── Build a Hex Model from a Drive ──────────────────────────────────────

/**
 * Create a hex model from the spiral drive's collapsed space.
 *
 * The model size scales with the number of sectors (drive space).
 * More sectors = more hex cells = more parameters = richer model.
 */
export function buildHexModel(totalSectors: number = 10000): HexModel {
  const grid = new HexGrid();
  for (let s = 0; s < totalSectors; s++) {
    grid.assignSector(sectorToSpiral(s, totalSectors));
  }

  const field = buildCollapsedField(grid, totalSectors);
  return new HexModel(field);
}

// ── Benchmark / Demo ─────────────────────────────────────────────────────

function fmt(n: number, d: number = 2): string { return n.toFixed(d); }

export function runHexModelDemo(options: {
  verbose?: boolean;
  totalSectors?: number;
  trainingRounds?: number;
} = {}): {
  model: HexModel;
  finalError: number;
  convergence: number;
} {
  const verbose = options.verbose ?? true;
  const totalSectors = options.totalSectors ?? 10000;
  const rounds = options.trainingRounds ?? 50;

  if (verbose) {
    console.log("HEX MODEL — The Drive IS the Neural Network");
    console.log("═".repeat(70));
    console.log(`Sectors: ${totalSectors} | Training rounds: ${rounds}`);
    console.log();
  }

  const model = buildHexModel(totalSectors);
  const s = model.stats();

  if (verbose) {
    console.log("  MODEL ARCHITECTURE:");
    console.log("  " + "─".repeat(66));
    console.log(`    Total cells:      ${s.cellCount}`);
    console.log(`    Total parameters: ${s.parameterCount}`);
    console.log(`    Estimated size:   ${(s.estimatedSizeBytes / 1024).toFixed(1)}KB (at current scale)`);
    console.log();
    console.log(`    ${"Zone".padEnd(8)} ${"Cells".padStart(6)} ${"Params".padStart(7)} ${"Weights".padStart(8)} ${"Bandwidth".padStart(10)} ${"Role"}`);
    console.log("    " + "─".repeat(58));

    const roles: Record<number, string> = {
      5: "encoder/discriminator (IS/ISN'T)",
      6: "latent space (pattern memory)",
      7: "decoder/generator (spectrum)",
    };
    const bw: Record<number, string> = { 5: "2 (binary)", 6: "3 (trinity)", 7: "7 (spectrum)" };

    for (const zone of [5, 6, 7]) {
      const z = s.byZone[zone];
      if (!z) continue;
      console.log(
        `    L${zone}`.padEnd(8) +
        `${String(z.cells).padStart(6)} ` +
        `${String(z.params).padStart(7)} ` +
        `${fmt(z.avgWeight, 4).padStart(8)} ` +
        `${(bw[zone] ?? "?").padStart(10)} ` +
        `${roles[zone] ?? ""}`
      );
    }

    // Show scaling
    console.log();
    console.log("  SCALING (same architecture, different drive sizes):");
    console.log("  " + "─".repeat(66));
    for (const [label, sectors] of [["64GB", 6400], ["256GB", 25600], ["931GB", 93100], ["2TB", 200000]] as const) {
      const testModel = buildHexModel(sectors);
      const ts = testModel.stats();
      console.log(
        `    ${label.padEnd(8)} ${String(ts.cellCount).padStart(6)} cells  ` +
        `${String(ts.parameterCount).padStart(7)} params  ` +
        `${(ts.estimatedSizeBytes / 1024 / 1024).toFixed(1).padStart(6)}MB model`
      );
    }
    console.log();
  }

  // ── Training Demo ──────────────────────────────────────────────────

  if (verbose) {
    console.log("  TRAINING — Generation (2→7) and Deconstruction (7→2)");
    console.log("  " + "─".repeat(66));
  }

  // Training examples:
  // Generation: binary seed → expected spectrum output
  // Deconstruction: spectrum input → expected binary truth
  const examples = [
    // Generate: strong IS signal should produce warm spectrum (red/orange/yellow dominant)
    { input: [0.9, 0.1], target: [0.8, 0.6, 0.5, 0.2, 0.1, 0.1, 0.05], direction: "generate" as const },
    // Generate: strong ISN'T signal should produce cool spectrum (blue/cyan/violet dominant)
    { input: [0.1, 0.9], target: [0.05, 0.1, 0.1, 0.2, 0.5, 0.6, 0.8], direction: "generate" as const },
    // Generate: balanced signal should produce green-centered spectrum
    { input: [0.5, 0.5], target: [0.2, 0.3, 0.4, 0.8, 0.4, 0.3, 0.2], direction: "generate" as const },
    // Deconstruct: warm spectrum should collapse to IS
    { input: [0.8, 0.6, 0.5, 0.2, 0.1, 0.1, 0.05], target: [0.9, 0.1], direction: "deconstruct" as const },
    // Deconstruct: cool spectrum should collapse to ISN'T
    { input: [0.05, 0.1, 0.1, 0.2, 0.5, 0.6, 0.8], target: [0.1, 0.9], direction: "deconstruct" as const },
    // Deconstruct: balanced spectrum should be uncertain
    { input: [0.3, 0.3, 0.4, 0.8, 0.4, 0.3, 0.3], target: [0.5, 0.5], direction: "deconstruct" as const },
  ];

  let lastResult = { epochs: 0, avgError: 1, totalCellUpdates: 0, convergence: 0 };

  for (let round = 0; round < rounds; round++) {
    lastResult = model.train(examples);

    if (verbose && (round === 0 || round === 4 || round === 9 || round === 24 || round === rounds - 1)) {
      console.log(
        `    Round ${String(round + 1).padStart(3)}: ` +
        `error=${fmt(lastResult.avgError, 4)} ` +
        `convergence=${fmt(lastResult.convergence * 100, 1)}% ` +
        `updates=${lastResult.totalCellUpdates}`
      );
    }
  }

  // ── Test the trained model ──────────────────────────────────────────

  if (verbose) {
    console.log();
    console.log("  INFERENCE — Testing trained model");
    console.log("  " + "─".repeat(66));

    // Generation test
    console.log("    GENERATION (seed → spectrum):");
    for (const seed of [[0.9, 0.1], [0.1, 0.9], [0.5, 0.5]] as [number, number][]) {
      const gen = model.generate(seed);
      const colors = ["R", "O", "Y", "G", "C", "B", "V"];
      const specStr = gen.spectrum.map((v, i) => `${colors[i]}=${fmt(v, 2)}`).join(" ");
      console.log(
        `      [${fmt(seed[0], 1)}, ${fmt(seed[1], 1)}] → ${specStr}` +
        `  peak=${colors[gen.dominantColor]} conf=${fmt(gen.confidence * 100, 0)}%`
      );
    }

    // Deconstruction test
    console.log();
    console.log("    DECONSTRUCTION (spectrum → IS/ISN'T):");
    const testSpectra = [
      { label: "warm",     values: [0.8, 0.7, 0.5, 0.2, 0.1, 0.1, 0.05] },
      { label: "cool",     values: [0.05, 0.1, 0.1, 0.2, 0.5, 0.7, 0.8] },
      { label: "balanced", values: [0.3, 0.3, 0.4, 0.8, 0.4, 0.3, 0.3] },
      { label: "noise",    values: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
    ];

    for (const test of testSpectra) {
      const dec = model.deconstruct(test.values);
      console.log(
        `      ${test.label.padEnd(10)} → IS=${fmt(dec.is * 100, 0)}% ISN'T=${fmt(dec.isnt * 100, 0)}% ` +
        `verdict=${dec.verdict.padEnd(10)} conf=${fmt(dec.confidence * 100, 0)}%`
      );
    }

    console.log();
    console.log("  THE MODEL:");
    console.log(`    Not an LLM. Not a diffusion model. A GEOMETRIC neural network.`);
    console.log(`    Each hex cell = one neuron. 6 faces = connections. Pressure = bias.`);
    console.log(`    Generation: binary seed → patterns → full spectrum (2→3→7)`);
    console.log(`    Deconstruction: full spectrum → patterns → binary truth (7→3→2)`);
    console.log(`    The Fibonacci ratio (8:13:21) balances encoder:latent:decoder.`);
    console.log(`    Scale it by giving it more drive space. Same architecture, more cells.`);
    console.log();
  }

  return {
    model,
    finalError: lastResult.avgError,
    convergence: lastResult.convergence,
  };
}
