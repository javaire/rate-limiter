import {
  RateLimitResult,
  SlidingWindowConfig,
  SlidingWindowState,
  TokenBucketConfig,
  TokenBucketState
} from "./types"

// spec: https://en.wikipedia.org/wiki/Token_bucket#Variations
// reference: https://github.com/redis-developer/redis-ratelimiting-js/blob/main/server/components/rate-limiting/token-bucket.ts
export function tokenBucket(
  state: TokenBucketState | null,
  config: TokenBucketConfig,
  now: number
): { state: TokenBucketState; result: RateLimitResult } {
  const { capacity, refillRatePerSec } = config
  const refillPerMs = refillRatePerSec / 1000
  const previousState = state ?? { tokens: capacity, lastRefillMs: now }
  const elapsedMs = Math.max(0, now - previousState.lastRefillMs)
  const tokens = Math.min(capacity, previousState.tokens + elapsedMs * refillPerMs)

  if (tokens < 1) {
    const retryAfterMs = refillPerMs > 0 ? Math.ceil((1 - tokens) / refillPerMs) : Infinity
    return { state: { tokens, lastRefillMs: now }, result: { allowed: false, retryAfterMs } }
  }

  return {
    state: { tokens: tokens - 1, lastRefillMs: now },
    result: { allowed: true, retryAfterMs: 0 }
  }
}

// spec: https://blog.cloudflare.com/counting-things-a-lot-of-different-things/#sliding-windows-to-the-rescue
// reference: https://github.com/redis-developer/redis-ratelimiting-js/blob/main/server/components/rate-limiting/sliding-window-counter.ts
export function slidingWindowCounter(
  state: SlidingWindowState | null,
  config: SlidingWindowConfig,
  now: number
): { state: SlidingWindowState; result: RateLimitResult } {
  const { limit, windowMs } = config
  const windowStartMs = Math.floor(now / windowMs) * windowMs

  let windowState = state ?? { currentCount: 0, previousCount: 0, windowStartMs }
  if (windowStartMs !== windowState.windowStartMs) {
    const windowsAdvanced = (windowStartMs - windowState.windowStartMs) / windowMs
    windowState =
      windowsAdvanced === 1
        ? { currentCount: 0, previousCount: windowState.currentCount, windowStartMs }
        : { currentCount: 0, previousCount: 0, windowStartMs }
  }

  const elapsedInWindow = now - windowStartMs
  const previousWindowWeight = (windowMs - elapsedInWindow) / windowMs
  const estimatedCount = windowState.currentCount + windowState.previousCount * previousWindowWeight

  if (estimatedCount >= limit) {
    return { state: windowState, result: { allowed: false, retryAfterMs: windowMs - elapsedInWindow } }
  }

  return {
    state: { ...windowState, currentCount: windowState.currentCount + 1 },
    result: { allowed: true, retryAfterMs: 0 }
  }
}
