/**
 * Metrics Tracking
 *
 * Tracks operation timing, success rates, and performance metrics.
 */

import { z } from 'zod';

/**
 * Metric types
 */
export const metricTypeSchema = z.enum(['counter', 'gauge', 'histogram', 'timer']);

export type MetricType = z.infer<typeof metricTypeSchema>;

/**
 * Histogram bucket
 */
export interface HistogramBucket {
  le: number; // Less than or equal
  count: number;
}

/**
 * Metric statistics
 */
export interface MetricStatistics {
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
}

/**
 * Metric definition
 */
export interface Metric {
  name: string;
  type: MetricType;
  description: string;
  labels?: string[];
  unit?: string;
}

/**
 * Serializes a label set into a deterministic cache key.
 * Shared by Counter and Gauge for labeled metric lookup.
 */
function getLabelKey(labels: Record<string, string>): string {
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(',');
}

/**
 * Counter metric - monotonically increasing value
 */
class Counter {
  readonly name: string;
  private value: number = 0;
  private readonly labels: Map<string, number> = new Map();

  constructor(name: string) {
    this.name = name;
  }

  inc(amount: number = 1, labels?: Record<string, string>): void {
    if (amount < 0) {
      throw new Error('Counter can only increase');
    }

    if (labels) {
      const key = getLabelKey(labels);
      const current = this.labels.get(key) ?? 0;
      this.labels.set(key, current + amount);
    } else {
      this.value += amount;
    }
  }

  get(labels?: Record<string, string>): number {
    if (labels) {
      const key = getLabelKey(labels);
      return this.labels.get(key) ?? 0;
    }
    return this.value;
  }

  reset(): void {
    this.value = 0;
    this.labels.clear();
  }
}

/**
 * Gauge metric - value that can go up and down
 */
class Gauge {
  readonly name: string;
  private value: number = 0;
  private readonly labels: Map<string, number> = new Map();

  constructor(name: string) {
    this.name = name;
  }

  set(value: number, labels?: Record<string, string>): void {
    if (labels) {
      const key = getLabelKey(labels);
      this.labels.set(key, value);
    } else {
      this.value = value;
    }
  }

  inc(amount: number = 1, labels?: Record<string, string>): void {
    if (labels) {
      const key = getLabelKey(labels);
      const current = this.labels.get(key) ?? 0;
      this.labels.set(key, current + amount);
    } else {
      this.value += amount;
    }
  }

  dec(amount: number = 1, labels?: Record<string, string>): void {
    this.inc(-amount, labels);
  }

  get(labels?: Record<string, string>): number {
    if (labels) {
      const key = getLabelKey(labels);
      return this.labels.get(key) ?? 0;
    }
    return this.value;
  }

  reset(): void {
    this.value = 0;
    this.labels.clear();
  }
}

/**
 * Histogram metric - distribution of values
 */
class Histogram {
  readonly name: string;
  private readonly bucketBoundaries: number[];
  private readonly counts: Map<number, number> = new Map();
  private sum: number = 0;
  private count: number = 0;
  private static readonly MAX_VALUES = 10000;

  /** Ring buffer for recent observations — fixed allocation, O(1) insert */
  private readonly buffer: Float64Array = new Float64Array(Histogram.MAX_VALUES);
  private writeIndex: number = 0;
  private bufferSize: number = 0;

  constructor(name: string, buckets?: number[]) {
    this.name = name;
    this.bucketBoundaries = buckets ?? [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

    // Initialize bucket counts
    for (const bucket of this.bucketBoundaries) {
      this.counts.set(bucket, 0);
    }
  }

  observe(value: number): void {
    this.sum += value;
    this.count++;

    // Ring buffer: overwrite oldest entry when full, no allocation
    this.buffer[this.writeIndex] = value;
    this.writeIndex = (this.writeIndex + 1) % Histogram.MAX_VALUES;
    if (this.bufferSize < Histogram.MAX_VALUES) {
      this.bufferSize++;
    }

    // Update bucket counts
    for (const bucket of this.bucketBoundaries) {
      if (value <= bucket) {
        const current = this.counts.get(bucket) ?? 0;
        this.counts.set(bucket, current + 1);
      }
    }
  }

  getStatistics(): MetricStatistics {
    if (this.bufferSize === 0) {
      return {
        count: 0,
        sum: 0,
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        p95: 0,
        p99: 0
      };
    }

    const sorted = Array.from(this.buffer.subarray(0, this.bufferSize)).sort((a, b) => a - b);
    const min = sorted[0] ?? 0;
    const max = sorted[sorted.length - 1] ?? 0;
    const mean = this.sum / this.count;
    const median = this.percentile(sorted, 50);
    const p95 = this.percentile(sorted, 95);
    const p99 = this.percentile(sorted, 99);

    return {
      count: this.count,
      sum: this.sum,
      min,
      max,
      mean,
      median,
      p95,
      p99
    };
  }

  getBuckets(): HistogramBucket[] {
    return this.bucketBoundaries.map((le) => ({
      le,
      count: this.counts.get(le) ?? 0
    }));
  }

  reset(): void {
    this.sum = 0;
    this.count = 0;
    this.writeIndex = 0;
    this.bufferSize = 0;
    for (const bucket of this.bucketBoundaries) {
      this.counts.set(bucket, 0);
    }
  }

  private percentile(sorted: number[], p: number): number {
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) {
      return sorted[lower] ?? 0;
    }

    return (sorted[lower] ?? 0) * (1 - weight) + (sorted[upper] ?? 0) * weight;
  }
}

/**
 * Timer metric - measures operation duration
 */
class Timer {
  readonly name: string;
  private readonly histogram: Histogram;

  constructor(name: string) {
    this.name = name;
    this.histogram = new Histogram(name, [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 30, 60]);
  }

  time<T>(fn: () => T): T {
    const start = Date.now();
    try {
      const result = fn();
      const duration = (Date.now() - start) / 1000; // Convert to seconds
      this.histogram.observe(duration);
      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.histogram.observe(duration);
      throw error;
    }
  }

  async timeAsync<T>(fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = (Date.now() - start) / 1000;
      this.histogram.observe(duration);
      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      this.histogram.observe(duration);
      throw error;
    }
  }

  observe(seconds: number): void {
    this.histogram.observe(seconds);
  }

  getStatistics(): MetricStatistics {
    return this.histogram.getStatistics();
  }

  reset(): void {
    this.histogram.reset();
  }
}

/**
 * Metrics registry
 */
export class MetricsRegistry {
  private counters: Map<string, Counter> = new Map();
  private gauges: Map<string, Gauge> = new Map();
  private histograms: Map<string, Histogram> = new Map();
  private timers: Map<string, Timer> = new Map();
  private metadata: Map<string, Metric> = new Map();

  /**
   * Register a counter
   * @param name
   * @param description
   * @param labels
   */
  counter(name: string, description?: string, labels?: string[]): Counter {
    const existing = this.counters.get(name);
    if (existing) {
      return existing;
    }
    const counter = new Counter(name);
    this.counters.set(name, counter);
    this.metadata.set(name, {
      name,
      type: 'counter',
      description: description ?? '',
      labels
    });
    return counter;
  }

  /**
   * Register a gauge
   * @param name
   * @param description
   * @param labels
   */
  gauge(name: string, description?: string, labels?: string[]): Gauge {
    const existing = this.gauges.get(name);
    if (existing) {
      return existing;
    }
    const gauge = new Gauge(name);
    this.gauges.set(name, gauge);
    this.metadata.set(name, {
      name,
      type: 'gauge',
      description: description ?? '',
      labels
    });
    return gauge;
  }

  /**
   * Register a histogram
   * @param name
   * @param description
   * @param buckets
   */
  histogram(name: string, description?: string, buckets?: number[]): Histogram {
    const existing = this.histograms.get(name);
    if (existing) {
      return existing;
    }
    const histogram = new Histogram(name, buckets);
    this.histograms.set(name, histogram);
    this.metadata.set(name, {
      name,
      type: 'histogram',
      description: description ?? ''
    });
    return histogram;
  }

  /**
   * Register a timer
   * @param name
   * @param description
   */
  timer(name: string, description?: string): Timer {
    const existing = this.timers.get(name);
    if (existing) {
      return existing;
    }
    const timer = new Timer(name);
    this.timers.set(name, timer);
    this.metadata.set(name, {
      name,
      type: 'timer',
      description: description ?? '',
      unit: 'seconds'
    });
    return timer;
  }

  /**
   * Get all registered metrics
   */
  getMetrics(): Metric[] {
    return Array.from(this.metadata.values());
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    for (const counter of this.counters.values()) {
      counter.reset();
    }
    for (const gauge of this.gauges.values()) {
      gauge.reset();
    }
    for (const histogram of this.histograms.values()) {
      histogram.reset();
    }
    for (const timer of this.timers.values()) {
      timer.reset();
    }
  }

  /**
   * Export metrics as JSON
   */
  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [name, counter] of this.counters.entries()) {
      result[name] = {
        name: counter.name,
        type: 'counter',
        value: counter.get()
      };
    }

    for (const [name, gauge] of this.gauges.entries()) {
      result[name] = {
        name: gauge.name,
        type: 'gauge',
        value: gauge.get()
      };
    }

    for (const [name, histogram] of this.histograms.entries()) {
      result[name] = {
        name: histogram.name,
        type: 'histogram',
        statistics: histogram.getStatistics(),
        buckets: histogram.getBuckets()
      };
    }

    for (const [name, timer] of this.timers.entries()) {
      result[name] = {
        name: timer.name,
        type: 'timer',
        statistics: timer.getStatistics()
      };
    }

    return result;
  }
}

/**
 * Global metrics registry
 */
let globalRegistry: MetricsRegistry | null = null;

/**
 * Get global metrics registry
 */
export function getMetrics(): MetricsRegistry {
  globalRegistry ??= new MetricsRegistry();
  return globalRegistry;
}

/**
 * Reset global metrics registry
 */
export function resetMetrics(): void {
  if (globalRegistry) {
    globalRegistry.reset();
  }
}
