/**
 * HEX MESH — Polygon-Native Node Communication
 * ==============================================
 *
 * Hex-to-hex transmission: polygon model activations travel as raw
 * float64 arrays. No JSON. No serialization. The hex format IS the
 * wire format. A neuron's activation on one machine is a neuron's
 * input on another — zero conversion.
 *
 * CIRCLE POOLING:
 *   Each node runs a PolygonModel with N circle neurons (outermost layer).
 *   When nodes connect, their circle layers MERGE:
 *
 *     Node A: ○(7 neurons)  ←→  Node B: ○(7 neurons)
 *     Combined: ○(14 neurons) — richer representation, same polygons
 *
 *   More nodes = bigger circle = more neurons. The inner polygons
 *   (△□⬠⬡) stay local. Only the circle layer is shared.
 *   This is how the model scales beyond one machine.
 *
 * PROTOCOL:
 *   Binary packets over TCP. No HTTP overhead. Fibonacci chunk sizing.
 *
 *   Packet format:
 *     [4B] magic   "HEX\x01"
 *     [1B] type    FORWARD=1, POOL=2, RESULT=3, STATS=4, TRAIN=5
 *     [1B] dir     GENERATE=0, DECONSTRUCT=1
 *     [2B] count   neuron count (uint16, max 65535)
 *     [N×8B] data  float64 activations (little-endian)
 *
 *   7-neuron circle: 8 + 56 = 64 bytes per packet
 *   490-neuron circle (10TB): 8 + 3920 = 3928 bytes
 *   Both fit within Fibonacci level 4 (3380 bytes) or 5 (5408 bytes)
 *
 * Author: Jonathan Pelchat
 * Shovelcat Theory — Hex Mesh
 */

import * as net from "net";
import { PolygonModel } from "./polygon-model";

// ── Packet Format ────────────────────────────────────────────────────────

const HEX_MAGIC = Buffer.from([0x48, 0x45, 0x58, 0x01]);  // "HEX\x01"

const enum PacketType {
  FORWARD  = 1,   // Run forward pass, return output
  POOL     = 2,   // Request circle layer activations
  RESULT   = 3,   // Response with activations
  STATS    = 4,   // Request/respond with model stats
  TRAIN    = 5,   // Send training example
}

const enum Direction {
  GENERATE    = 0,
  DECONSTRUCT = 1,
}

export interface HexPacket {
  type: PacketType;
  direction: Direction;
  count: number;
  data: number[];
}

/** Encode a HexPacket to binary buffer */
export function encodePacket(pkt: HexPacket): Buffer {
  const headerSize = 8;  // 4 magic + 1 type + 1 dir + 2 count
  const dataSize = pkt.count * 8;  // float64 per neuron
  const buf = Buffer.alloc(headerSize + dataSize);

  // Header
  HEX_MAGIC.copy(buf, 0);
  buf.writeUInt8(pkt.type, 4);
  buf.writeUInt8(pkt.direction, 5);
  buf.writeUInt16LE(pkt.count, 6);

  // Data: raw float64 array
  for (let i = 0; i < pkt.count; i++) {
    buf.writeDoubleLE(pkt.data[i] ?? 0, headerSize + i * 8);
  }

  return buf;
}

/** Decode a binary buffer into a HexPacket */
export function decodePacket(buf: Buffer): HexPacket | null {
  if (buf.length < 8) return null;

  // Verify magic
  if (buf[0] !== 0x48 || buf[1] !== 0x45 || buf[2] !== 0x58 || buf[3] !== 0x01) {
    return null;
  }

  const type = buf.readUInt8(4) as PacketType;
  const direction = buf.readUInt8(5) as Direction;
  const count = buf.readUInt16LE(6);

  const data: number[] = [];
  for (let i = 0; i < count && (8 + i * 8 + 8) <= buf.length; i++) {
    data.push(buf.readDoubleLE(8 + i * 8));
  }

  return { type, direction, count, data };
}

/** Size of a packet for N neurons */
export function packetSize(neuronCount: number): number {
  return 8 + neuronCount * 8;
}

// ── Peer Connection ──────────────────────────────────────────────────────

interface Peer {
  id: string;
  host: string;
  port: number;
  socket: net.Socket | null;
  circleNeurons: number;
  lastActivations: number[];
  connected: boolean;
  latencyMs: number;
}

// ── Mesh Node ────────────────────────────────────────────────────────────

export class MeshNode {
  /** Local polygon model */
  readonly model: PolygonModel;
  /** Node ID */
  readonly id: string;
  /** TCP server */
  private server: net.Server | null = null;
  /** Connected peers */
  private peers: Map<string, Peer> = new Map();
  /** Server port */
  private port: number = 0;
  /** Verbose logging */
  private verbose: boolean;

  constructor(options: {
    circleNeurons?: number;
    id?: string;
    verbose?: boolean;
  } = {}) {
    this.model = new PolygonModel({
      circleNeurons: options.circleNeurons ?? 7,
    });
    this.id = options.id ?? `node-${Math.random().toString(36).slice(2, 8)}`;
    this.verbose = options.verbose ?? false;
  }

  /** Start the mesh server */
  start(port: number = 0): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.listen(port, "0.0.0.0", () => {
        const addr = this.server!.address() as net.AddressInfo;
        this.port = addr.port;
        if (this.verbose) {
          console.log(`  [${this.id}] Mesh listening on port ${this.port}`);
        }
        resolve(this.port);
      });

      this.server.on("error", reject);
    });
  }

  /** Connect to a peer node */
  async connect(host: string, port: number): Promise<string> {
    const peerId = `${host}:${port}`;

    if (this.peers.has(peerId)) {
      return peerId;
    }

    return new Promise((resolve, reject) => {
      const socket = net.createConnection(port, host, () => {
        const peer: Peer = {
          id: peerId,
          host,
          port,
          socket,
          circleNeurons: 0,
          lastActivations: [],
          connected: true,
          latencyMs: 0,
        };
        this.peers.set(peerId, peer);

        // Request stats to learn peer's circle size
        const statsPkt = encodePacket({
          type: PacketType.STATS,
          direction: Direction.GENERATE,
          count: 0,
          data: [],
        });
        socket.write(statsPkt);

        if (this.verbose) {
          console.log(`  [${this.id}] Connected to peer ${peerId}`);
        }
        resolve(peerId);
      });

      // Handle incoming data from peer
      socket.on("data", (buf: Buffer) => {
        this.handlePeerData(peerId, buf);
      });

      socket.on("close", () => {
        const peer = this.peers.get(peerId);
        if (peer) peer.connected = false;
      });

      socket.on("error", (err) => {
        if (this.peers.has(peerId)) {
          this.peers.get(peerId)!.connected = false;
        }
        reject(err);
      });
    });
  }

  /** Handle incoming connection */
  private handleConnection(socket: net.Socket): void {
    let buffer = Buffer.alloc(0);

    socket.on("data", (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);

      // Process complete packets
      while (buffer.length >= 8) {
        const count = buffer.readUInt16LE(6);
        const pktLen = 8 + count * 8;
        if (buffer.length < pktLen) break;

        const pktBuf = buffer.subarray(0, pktLen);
        buffer = buffer.subarray(pktLen);

        const pkt = decodePacket(pktBuf);
        if (!pkt) continue;

        this.handlePacket(pkt, socket);
      }
    });
  }

  /** Handle a decoded packet */
  private handlePacket(pkt: HexPacket, socket: net.Socket): void {
    const dir = pkt.direction === Direction.GENERATE ? "generate" : "deconstruct";

    switch (pkt.type) {
      case PacketType.FORWARD: {
        // Run forward pass on local model
        const result = this.model.forward(pkt.data, dir);
        const response = encodePacket({
          type: PacketType.RESULT,
          direction: pkt.direction,
          count: result.output.length,
          data: result.output,
        });
        socket.write(response);
        break;
      }

      case PacketType.POOL: {
        // Return circle layer activations for the given input
        const result = this.model.forward(pkt.data, dir);
        // Circle is the last layer output
        const circleAct = result.layerOutputs[result.layerOutputs.length - 1] ?? [];
        const response = encodePacket({
          type: PacketType.RESULT,
          direction: pkt.direction,
          count: circleAct.length,
          data: circleAct,
        });
        socket.write(response);
        break;
      }

      case PacketType.STATS: {
        // Return model stats as a packet
        const stats = this.model.stats();
        const response = encodePacket({
          type: PacketType.STATS,
          direction: Direction.GENERATE,
          count: 3,
          data: [stats.circleNeurons, stats.parameterCount, stats.totalNeurons],
        });
        socket.write(response);
        break;
      }

      case PacketType.TRAIN: {
        // Train on received example
        // First half of data = input, second half = target
        const mid = Math.floor(pkt.count / 2);
        const input = pkt.data.slice(0, mid);
        const target = pkt.data.slice(mid);
        this.model.train([{ input, target, direction: dir }]);
        // Acknowledge with stats
        const stats = this.model.stats();
        const response = encodePacket({
          type: PacketType.STATS,
          direction: pkt.direction,
          count: 3,
          data: [stats.circleNeurons, stats.parameterCount, stats.totalNeurons],
        });
        socket.write(response);
        break;
      }
    }
  }

  /** Handle data from a connected peer */
  private handlePeerData(peerId: string, buf: Buffer): void {
    const pkt = decodePacket(buf);
    if (!pkt) return;

    const peer = this.peers.get(peerId);
    if (!peer) return;

    switch (pkt.type) {
      case PacketType.RESULT:
        peer.lastActivations = pkt.data;
        break;
      case PacketType.STATS:
        if (pkt.data.length >= 1) {
          peer.circleNeurons = pkt.data[0];
        }
        if (this.verbose) {
          console.log(`  [${this.id}] Peer ${peerId}: circle=${peer.circleNeurons} neurons`);
        }
        break;
    }
  }

  /** Pool circle activations from all peers for a given input.
   *  Returns combined circle: local neurons + all peer neurons. */
  async poolCircle(input: number[], direction: "generate" | "deconstruct"): Promise<number[]> {
    // Local forward pass
    const local = this.model.forward(input, direction);
    const localCircle = local.output;  // circle layer = final output

    // Request from all connected peers
    const dir = direction === "generate" ? Direction.GENERATE : Direction.DECONSTRUCT;
    const promises: Promise<number[]>[] = [];

    for (const [, peer] of this.peers) {
      if (!peer.connected || !peer.socket) continue;

      promises.push(new Promise<number[]>((resolve) => {
        const pkt = encodePacket({
          type: PacketType.POOL,
          direction: dir,
          count: input.length,
          data: input,
        });

        const start = Date.now();

        // Wait for response (with timeout)
        const onData = (buf: Buffer) => {
          const resp = decodePacket(buf);
          if (resp && resp.type === PacketType.RESULT) {
            peer.latencyMs = Date.now() - start;
            peer.lastActivations = resp.data;
            peer.socket!.removeListener("data", onData);
            resolve(resp.data);
          }
        };

        peer.socket!.on("data", onData);
        peer.socket!.write(pkt);

        // Timeout: don't wait forever for slow peers
        setTimeout(() => {
          peer.socket!.removeListener("data", onData);
          resolve(peer.lastActivations);  // use cached if timeout
        }, 1000);
      }));
    }

    const peerResults = await Promise.all(promises);

    // Combine: local circle + all peer circles = pooled circle
    const pooled = [...localCircle];
    for (const result of peerResults) {
      pooled.push(...result);
    }

    return pooled;
  }

  /** Get mesh status */
  status(): {
    id: string;
    port: number;
    localCircle: number;
    peers: Array<{ id: string; circleNeurons: number; connected: boolean; latencyMs: number }>;
    totalCircle: number;
    packetBytes: { local: number; pooled: number };
  } {
    const localCircle = this.model.circleNeurons;
    let totalCircle = localCircle;
    const peerList: Array<{ id: string; circleNeurons: number; connected: boolean; latencyMs: number }> = [];

    for (const [, peer] of this.peers) {
      peerList.push({
        id: peer.id,
        circleNeurons: peer.circleNeurons,
        connected: peer.connected,
        latencyMs: peer.latencyMs,
      });
      if (peer.connected) {
        totalCircle += peer.circleNeurons;
      }
    }

    return {
      id: this.id,
      port: this.port,
      localCircle,
      peers: peerList,
      totalCircle,
      packetBytes: {
        local: packetSize(localCircle),
        pooled: packetSize(totalCircle),
      },
    };
  }

  /** Stop the mesh node */
  stop(): void {
    for (const [, peer] of this.peers) {
      peer.socket?.destroy();
    }
    this.peers.clear();
    this.server?.close();
    this.server = null;
  }
}

// ── Demo ──────────────────────────────────────────────────────────────────

function fmt(n: number, d: number = 2): string { return n.toFixed(d); }

export async function runMeshDemo(options: {
  verbose?: boolean;
  nodeCount?: number;
  trainingRounds?: number;
} = {}): Promise<void> {
  const verbose = options.verbose ?? true;
  const nodeCount = options.nodeCount ?? 3;
  const rounds = options.trainingRounds ?? 200;

  if (verbose) {
    console.log("HEX MESH — Polygon-Native Node Communication");
    console.log("═".repeat(70));
    console.log();
    console.log("  PACKET FORMAT (hex-native, zero conversion):");
    console.log("  " + "─".repeat(66));
    console.log(`    [4B] magic "HEX\\x01"  [1B] type  [1B] direction  [2B] count`);
    console.log(`    [N×8B] float64 activations — raw neuron values, no JSON`);
    console.log();
    console.log(`    7-neuron circle:   ${packetSize(7)} bytes (fits in 1 TCP segment)`);
    console.log(`    49-neuron (931GB): ${packetSize(49)} bytes`);
    console.log(`    490-neuron (10TB): ${packetSize(490)} bytes`);
    console.log();
  }

  // Create nodes
  const nodes: MeshNode[] = [];
  for (let i = 0; i < nodeCount; i++) {
    nodes.push(new MeshNode({
      circleNeurons: 7,
      id: `node-${i}`,
      verbose,
    }));
  }

  if (verbose) {
    console.log(`  STARTING ${nodeCount} MESH NODES:`);
    console.log("  " + "─".repeat(66));
  }

  // Start all nodes
  const ports: number[] = [];
  for (const node of nodes) {
    const port = await node.start(0);  // random port
    ports.push(port);
  }

  // Connect in a chain: 0→1, 1→2, 2→0 (full mesh for 3 nodes)
  if (verbose) {
    console.log();
    console.log("  CONNECTING MESH:");
    console.log("  " + "─".repeat(66));
  }

  for (let i = 0; i < nodeCount; i++) {
    const nextIdx = (i + 1) % nodeCount;
    try {
      await nodes[i].connect("127.0.0.1", ports[nextIdx]);
    } catch (e) {
      if (verbose) console.log(`    Failed to connect node-${i} → node-${nextIdx}`);
    }
  }

  // Wait a moment for stats exchange
  await new Promise(r => setTimeout(r, 200));

  // Show mesh status
  if (verbose) {
    console.log();
    console.log("  MESH STATUS:");
    console.log("  " + "─".repeat(66));

    for (const node of nodes) {
      const st = node.status();
      const peerStr = st.peers.map(p =>
        `${p.id}(○=${p.circleNeurons}${p.connected ? "" : " DISCONNECTED"})`
      ).join(", ");
      console.log(
        `    ${st.id}: local ○=${st.localCircle}, ` +
        `pooled ○=${st.totalCircle}, ` +
        `packet=${st.packetBytes.local}B → ${st.packetBytes.pooled}B`
      );
      if (peerStr) console.log(`      peers: ${peerStr}`);
    }
  }

  // Train each node independently
  if (verbose) {
    console.log();
    console.log("  TRAINING (each node independently):");
    console.log("  " + "─".repeat(66));
  }

  const examples = [
    { input: [0.9, 0.1], target: [0.8, 0.6, 0.5, 0.2, 0.1, 0.1, 0.05], direction: "generate" as const },
    { input: [0.1, 0.9], target: [0.05, 0.1, 0.1, 0.2, 0.5, 0.6, 0.8], direction: "generate" as const },
    { input: [0.5, 0.5], target: [0.2, 0.3, 0.4, 0.8, 0.4, 0.3, 0.2], direction: "generate" as const },
    { input: [0.8, 0.6, 0.5, 0.2, 0.1, 0.1, 0.05], target: [0.9, 0.1], direction: "deconstruct" as const },
    { input: [0.05, 0.1, 0.1, 0.2, 0.5, 0.6, 0.8], target: [0.1, 0.9], direction: "deconstruct" as const },
  ];

  for (let round = 0; round < rounds; round++) {
    for (const node of nodes) {
      node.model.train(examples, 0.5);
    }

    if (verbose && (round === 0 || round === rounds - 1)) {
      for (const node of nodes) {
        const r = node.model.train(examples, 0);  // dry run for error
        console.log(`    ${node.id} round ${round + 1}: error=${fmt(r.avgError, 4)}`);
      }
    }
  }

  // Test circle pooling
  if (verbose) {
    console.log();
    console.log("  CIRCLE POOLING (combined neurons across mesh):");
    console.log("  " + "─".repeat(66));
  }

  // Generation: pooled vs local
  const testSeed: [number, number] = [0.9, 0.1];
  const localGen = nodes[0].model.generate(testSeed);
  const pooledCircle = await nodes[0].poolCircle(testSeed, "generate");

  if (verbose) {
    const colors = ["R", "O", "Y", "G", "C", "B", "V"];
    const localStr = localGen.spectrum.map((v, i) => `${colors[i]}=${fmt(v, 2)}`).join(" ");
    console.log(`    LOCAL  (○=${nodes[0].model.circleNeurons}):  ${localStr}`);
    console.log(`    POOLED (○=${pooledCircle.length}): [${pooledCircle.map(v => fmt(v, 2)).join(", ")}]`);
    console.log();
    console.log(`    Local:  ${nodes[0].model.circleNeurons} neurons → ${packetSize(nodes[0].model.circleNeurons)} bytes`);
    console.log(`    Pooled: ${pooledCircle.length} neurons → ${packetSize(pooledCircle.length)} bytes`);
    console.log(`    Gain:   ${pooledCircle.length - nodes[0].model.circleNeurons} neurons from ${nodes.length - 1} peers`);

    console.log();
    console.log("  THE MESH:");
    console.log(`    Every node runs △□⬠⬡○ locally. Only ○ is shared.`);
    console.log(`    Activations travel as raw float64 — no JSON, no conversion.`);
    console.log(`    ${packetSize(7)} bytes per 7-neuron circle. Fits in one TCP segment.`);
    console.log(`    Connect more nodes → bigger circle → richer model.`);
    console.log(`    The inner polygons (△□⬠⬡) stay private. The circle is public.`);
    console.log();
  }

  // Cleanup
  for (const node of nodes) {
    node.stop();
  }
}
