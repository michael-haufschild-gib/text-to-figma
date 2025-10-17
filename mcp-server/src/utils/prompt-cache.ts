/**
 * Prompt Cache
 *
 * LRU cache implementation for system prompts with:
 * - Least Recently Used eviction policy
 * - TTL-based expiration
 * - Memory usage monitoring
 * - Statistics tracking
 */

import { z } from 'zod';

/**
 * Cache entry structure
 */
interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  lastAccessed: number;
  hits: number;
  size: number;
}

/**
 * Cache statistics
 */
export interface CacheStatistics {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  capacity: number;
  memoryUsage: number;
  maxMemoryUsage: number;
  entries: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

/**
 * Cache configuration
 */
export const cacheConfigSchema = z.object({
  maxSize: z.number().int().positive().default(100).describe('Maximum number of entries'),
  ttl: z.number().int().positive().default(3600000).describe('Time to live in milliseconds (default: 1 hour)'),
  maxMemoryUsage: z.number().int().positive().default(10485760).describe('Maximum memory usage in bytes (default: 10MB)')
});

export type CacheConfig = z.infer<typeof cacheConfigSchema>;

/**
 * LRU Cache with TTL support
 */
export class PromptCache<T = string> {
  private cache: Map<string, CacheEntry<T>>;
  private readonly maxSize: number;
  private readonly ttl: number;
  private readonly maxMemoryUsage: number;
  private hits: number = 0;
  private misses: number = 0;
  private currentMemoryUsage: number = 0;

  constructor(config?: Partial<CacheConfig>) {
    const validated = cacheConfigSchema.parse(config ?? {});
    this.maxSize = validated.maxSize;
    this.ttl = validated.ttl;
    this.maxMemoryUsage = validated.maxMemoryUsage;
    this.cache = new Map();
  }

  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.delete(key);
      this.misses++;
      return undefined;
    }

    // Update access metadata
    entry.lastAccessed = now;
    entry.hits++;
    this.hits++;

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T): void {
    const now = Date.now();
    const size = this.estimateSize(value);

    // Check if adding this entry would exceed memory limit
    if (size > this.maxMemoryUsage) {
      throw new Error(`Entry size (${size} bytes) exceeds maximum memory usage (${this.maxMemoryUsage} bytes)`);
    }

    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.delete(key);
    }

    // Evict entries if necessary
    while (
      (this.cache.size >= this.maxSize || this.currentMemoryUsage + size > this.maxMemoryUsage) &&
      this.cache.size > 0
    ) {
      this.evictLRU();
    }

    // Add new entry
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: now,
      lastAccessed: now,
      hits: 0,
      size
    };

    this.cache.set(key, entry);
    this.currentMemoryUsage += size;
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    this.cache.delete(key);
    this.currentMemoryUsage -= entry.size;

    return true;
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.cache.clear();
    this.currentMemoryUsage = 0;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    // Map keys are ordered by insertion, and we move accessed items to the end
    // So the first entry is the least recently used
    const firstKey = this.cache.keys().next().value;

    if (firstKey !== undefined) {
      this.delete(firstKey);
    }
  }

  /**
   * Estimate size of value in bytes
   */
  private estimateSize(value: T): number {
    if (typeof value === 'string') {
      // UTF-8 encoding: most characters are 1-4 bytes
      // Use conservative estimate of 2 bytes per character
      return value.length * 2;
    }

    if (typeof value === 'number') {
      return 8; // 64-bit number
    }

    if (typeof value === 'boolean') {
      return 4;
    }

    if (value === null || value === undefined) {
      return 0;
    }

    // For objects, use JSON string length as estimate
    try {
      const json = JSON.stringify(value);
      return json.length * 2;
    } catch {
      // If serialization fails, use conservative estimate
      return 1024;
    }
  }

  /**
   * Remove expired entries
   */
  prune(): number {
    const now = Date.now();
    let prunedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.delete(key);
        prunedCount++;
      }
    }

    return prunedCount;
  }

  /**
   * Get cache statistics
   */
  getStatistics(): CacheStatistics {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;

    let oldestEntry: number | null = null;
    let newestEntry: number | null = null;

    for (const entry of this.cache.values()) {
      if (oldestEntry === null || entry.timestamp < oldestEntry) {
        oldestEntry = entry.timestamp;
      }
      if (newestEntry === null || entry.timestamp > newestEntry) {
        newestEntry = entry.timestamp;
      }
    }

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: Math.round(hitRate * 10000) / 100, // Percentage with 2 decimals
      size: this.cache.size,
      capacity: this.maxSize,
      memoryUsage: this.currentMemoryUsage,
      maxMemoryUsage: this.maxMemoryUsage,
      entries: this.cache.size,
      oldestEntry,
      newestEntry
    };
  }

  /**
   * Get all keys in cache
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all values in cache
   */
  values(): T[] {
    return Array.from(this.cache.values()).map(entry => entry.value);
  }

  /**
   * Get all entries in cache
   */
  entries(): Array<{ key: string; value: T; metadata: Omit<CacheEntry<T>, 'value'> }> {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      value: entry.value,
      metadata: {
        key: entry.key,
        timestamp: entry.timestamp,
        lastAccessed: entry.lastAccessed,
        hits: entry.hits,
        size: entry.size
      }
    }));
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get memory usage
   */
  get memoryUsage(): number {
    return this.currentMemoryUsage;
  }

  /**
   * Get hit rate
   */
  get hitRate(): number {
    const totalRequests = this.hits + this.misses;
    return totalRequests > 0 ? this.hits / totalRequests : 0;
  }
}

/**
 * Global prompt cache instance
 */
let globalPromptCache: PromptCache<string> | null = null;

/**
 * Get or create global prompt cache
 */
export function getPromptCache(config?: CacheConfig): PromptCache<string> {
  if (!globalPromptCache) {
    globalPromptCache = new PromptCache<string>(config);
  }
  return globalPromptCache;
}

/**
 * Reset global prompt cache
 */
export function resetPromptCache(): void {
  if (globalPromptCache) {
    globalPromptCache.clear();
  }
  globalPromptCache = null;
}

/**
 * Cache key generator for prompts
 */
export function generatePromptCacheKey(
  templateName: string,
  parameters?: Record<string, unknown>
): string {
  if (!parameters || Object.keys(parameters).length === 0) {
    return `prompt:${templateName}`;
  }

  // Sort parameters for consistent keys
  const sortedParams = Object.keys(parameters)
    .sort()
    .map(key => `${key}=${JSON.stringify(parameters[key])}`)
    .join('&');

  return `prompt:${templateName}?${sortedParams}`;
}

/**
 * Cached prompt loader
 */
export async function loadCachedPrompt(
  templateName: string,
  loader: () => Promise<string> | string,
  parameters?: Record<string, unknown>,
  cacheConfig?: CacheConfig
): Promise<string> {
  const cache = getPromptCache(cacheConfig);
  const cacheKey = generatePromptCacheKey(templateName, parameters);

  // Try to get from cache
  const cached = cache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  // Load and cache
  const prompt = await loader();
  cache.set(cacheKey, prompt);

  return prompt;
}
