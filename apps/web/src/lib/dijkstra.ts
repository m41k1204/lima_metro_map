import type { Graph } from "./types";

type DijkstraResult = {
  path: string[];
  cost: number;
} | null;

// Binary min-heap sobre [cost, nodeId]
class MinHeap {
  private data: [number, string][] = [];

  get size() { return this.data.length; }

  push(cost: number, node: string) {
    this.data.push([cost, node]);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): [number, string] | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[parent][0] <= this.data[i][0]) break;
      [this.data[parent], this.data[i]] = [this.data[i], this.data[parent]];
      i = parent;
    }
  }

  private sinkDown(i: number) {
    const n = this.data.length;
    while (true) {
      let min = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this.data[l][0] < this.data[min][0]) min = l;
      if (r < n && this.data[r][0] < this.data[min][0]) min = r;
      if (min === i) break;
      [this.data[min], this.data[i]] = [this.data[i], this.data[min]];
      i = min;
    }
  }
}

export function dijkstra(graph: Graph, startId: string, endId: string): DijkstraResult {
  if (startId === endId) return { path: [startId], cost: 0 };

  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const heap = new MinHeap();

  dist.set(startId, 0);
  heap.push(0, startId);

  while (heap.size > 0) {
    const [cost, node] = heap.pop()!;

    if (node === endId) break;
    if (cost > (dist.get(node) ?? Infinity)) continue;

    for (const edge of graph.get(node) ?? []) {
      const newCost = cost + edge.weight;
      if (newCost < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, newCost);
        prev.set(edge.to, node);
        heap.push(newCost, edge.to);
      }
    }
  }

  if (!dist.has(endId)) return null;

  const path: string[] = [];
  let current: string | undefined = endId;
  while (current) {
    path.unshift(current);
    current = prev.get(current);
  }

  if (path[0] !== startId) return null;
  return { path, cost: dist.get(endId)! };
}
