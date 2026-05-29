import { slidingWindowCounter, tokenBucket } from "../src/rateLimit/algorithms"
import {
  RateLimitAlgorithm,
  SlidingWindowConfig,
  SlidingWindowState,
  TokenBucketConfig,
  TokenBucketState
} from "../src/rateLimit/types"

describe("tokenBucket", () => {
  const config: TokenBucketConfig = { algorithm: RateLimitAlgorithm.TokenBucket, capacity: 3, refillRatePerSec: 1 }

  it("allows up to capacity then blocks", () => {
    let state: TokenBucketState | null = null
    const now = 1000

    for (let i = 0; i < 3; i++) {
      const attempt = tokenBucket(state, config, now)
      state = attempt.state
      expect(attempt.result.allowed).toBe(true)
    }

    const blocked = tokenBucket(state, config, now)
    expect(blocked.result.allowed).toBe(false)
    expect(blocked.result.retryAfterMs).toBeGreaterThan(0)
  })

  it("refills over elapsed time", () => {
    const empty: TokenBucketState = { tokens: 0, lastRefillMs: 1000 }
    const attempt = tokenBucket(empty, config, 2000)
    expect(attempt.result.allowed).toBe(true)
  })
})

describe("slidingWindowCounter", () => {
  const config: SlidingWindowConfig = { algorithm: RateLimitAlgorithm.SlidingWindowCounter, limit: 3, windowMs: 1000 }

  it("allows up to the limit then blocks within a window", () => {
    let state: SlidingWindowState | null = null
    const now = 5000

    for (let i = 0; i < 3; i++) {
      const attempt = slidingWindowCounter(state, config, now)
      state = attempt.state
      expect(attempt.result.allowed).toBe(true)
    }

    const blocked = slidingWindowCounter(state, config, now)
    expect(blocked.result.allowed).toBe(false)
  })

  it("weighted estimate decays as the window rolls forward", () => {
    let state: SlidingWindowState | null = null
    const firstWindow = 5000
    for (let i = 0; i < 3; i++) {
      state = slidingWindowCounter(state, config, firstWindow).state
    }

    const startOfNextWindow = slidingWindowCounter(state, config, 6000)
    expect(startOfNextWindow.result.allowed).toBe(false)

    const endOfNextWindow = slidingWindowCounter(state, config, 6999)
    expect(endOfNextWindow.result.allowed).toBe(true)
  })
})
