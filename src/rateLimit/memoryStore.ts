import Redis from "ioredis"
import { slidingWindowCounterScript, tokenBucketScript } from "./algorithms.lua"
import { EndpointConfig, RateLimitAlgorithm, RateLimitResult, RateLimitStore } from "./types"

type ScriptResult = [number, number]

type RateLimitRedis = Redis & {
  tokenBucket(key: string, capacity: number, refillRatePerSec: number, now: number): Promise<ScriptResult>
  slidingWindowCounter(key: string, limit: number, windowMs: number, now: number): Promise<ScriptResult>
}

export class MemoryStore implements RateLimitStore {
  private readonly client: RateLimitRedis

  constructor(redisUrl: string) {
    const client = new Redis(redisUrl, { maxRetriesPerRequest: 2, lazyConnect: true })
    client.defineCommand("tokenBucket", { numberOfKeys: 1, lua: tokenBucketScript })
    client.defineCommand("slidingWindowCounter", { numberOfKeys: 1, lua: slidingWindowCounterScript })
    this.client = client as RateLimitRedis
  }

  async init(): Promise<void> {
    await this.client.connect()
  }

  async close(): Promise<void> {
    await this.client.quit()
  }

  async consume(key: string, config: EndpointConfig, now: number): Promise<RateLimitResult> {
    const [allowed, retryAfterMs] =
      config.algorithm === RateLimitAlgorithm.TokenBucket
        ? await this.client.tokenBucket(key, config.capacity, config.refillRatePerSec, now)
        : await this.client.slidingWindowCounter(key, config.limit, config.windowMs, now)

    return { allowed: allowed === 1, retryAfterMs }
  }
}
