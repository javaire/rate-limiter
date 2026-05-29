import { MemoryStore } from "./memoryStore"
import { PersistentStore } from "./persistentStore"
import { RateLimitStore, StorageStrategy } from "./types"

export function createRateLimitStore(): RateLimitStore {
  const strategy = process.env.STORE
  if (!strategy) {
    throw new Error("STORE is required")
  }

  if (strategy === StorageStrategy.Memory) {
    const redisUrl = process.env.REDIS_URL
    if (!redisUrl) {
      throw new Error("REDIS_URL is required when STORE=memory")
    }

    return new MemoryStore(redisUrl)
  }

  if (strategy === StorageStrategy.Persistent) {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required when STORE=persistent")
    }

    return new PersistentStore(databaseUrl)
  }

  throw new Error(
    `Unknown STORE "${strategy}" (expected ${StorageStrategy.Memory} | ${StorageStrategy.Persistent})`
  )
}
