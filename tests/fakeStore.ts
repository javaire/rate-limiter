import { slidingWindowCounter, tokenBucket } from "../src/rateLimit/algorithms"
import {
  EndpointConfig,
  RateLimitAlgorithm,
  RateLimitResult,
  RateLimitState,
  RateLimitStore,
  SlidingWindowState,
  TokenBucketState
} from "../src/rateLimit/types"

export class FakeStore implements RateLimitStore {
  private readonly states = new Map<string, RateLimitState>()

  async init(): Promise<void> {}

  async close(): Promise<void> {
    this.states.clear()
  }

  async consume(key: string, config: EndpointConfig, now: number): Promise<RateLimitResult> {
    const previousState = this.states.get(key) ?? null

    if (config.algorithm === RateLimitAlgorithm.TokenBucket) {
      const { state, result } = tokenBucket(previousState as TokenBucketState | null, config, now)
      this.states.set(key, state)
      return result
    }

    const { state, result } = slidingWindowCounter(previousState as SlidingWindowState | null, config, now)
    this.states.set(key, state)
    return result
  }
}
