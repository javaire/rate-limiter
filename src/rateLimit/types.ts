export enum StorageStrategy {
  Memory = "memory",
  Persistent = "persistent"
}

export enum RateLimitAlgorithm {
  TokenBucket = "tokenBucket",
  SlidingWindowCounter = "slidingWindowCounter"
}

export interface TokenBucketConfig {
  algorithm: RateLimitAlgorithm.TokenBucket
  capacity: number
  refillRatePerSec: number
}

export interface SlidingWindowConfig {
  algorithm: RateLimitAlgorithm.SlidingWindowCounter
  limit: number
  windowMs: number
}

export type EndpointConfig = TokenBucketConfig | SlidingWindowConfig

export interface TokenBucketState {
  tokens: number
  lastRefillMs: number
}

export interface SlidingWindowState {
  currentCount: number
  previousCount: number
  windowStartMs: number
}

export type RateLimitState = TokenBucketState | SlidingWindowState

export interface RateLimitResult {
  allowed: boolean
  retryAfterMs: number
}

export interface RateLimitStore {
  consume(key: string, config: EndpointConfig, now: number): Promise<RateLimitResult>

  init(): Promise<void>

  close(): Promise<void>
}
