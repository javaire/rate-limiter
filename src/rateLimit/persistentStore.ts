import pgPromise, { IDatabase, IMain } from "pg-promise"
import { allRateLimitKeys } from "../config/clients"
import { slidingWindowCounter, tokenBucket } from "./algorithms"
import {
  EndpointConfig,
  RateLimitAlgorithm,
  RateLimitResult,
  RateLimitState,
  RateLimitStore,
  SlidingWindowState,
  TokenBucketState
} from "./types"

const pgpMain: IMain = pgPromise()

const computeNextState = (
  previousState: RateLimitState | null,
  config: EndpointConfig,
  now: number
): { state: RateLimitState; result: RateLimitResult } => {
  if (config.algorithm === RateLimitAlgorithm.TokenBucket) {
    return tokenBucket(previousState as TokenBucketState | null, config, now)
  }

  return slidingWindowCounter(previousState as SlidingWindowState | null, config, now)
}

export class PersistentStore implements RateLimitStore {
  private readonly database: IDatabase<unknown>

  constructor(connectionString: string) {
    this.database = pgpMain(connectionString)
  }

  async init(): Promise<void> {
    await this.database.none("CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, state JSONB NOT NULL)")
    await this.database.tx((transaction) =>
      transaction.batch(
        allRateLimitKeys().map((key) =>
          transaction.none(
            "INSERT INTO rate_limits (key, state) VALUES ($(key), 'null'::jsonb) ON CONFLICT (key) DO NOTHING",
            { key }
          )
        )
      )
    )
  }

  async close(): Promise<void> {
    await pgpMain.end()
  }

  async consume(key: string, config: EndpointConfig, now: number): Promise<RateLimitResult> {
    return this.database.tx(async (transaction) => {
      const existingRow = await transaction.oneOrNone<{ state: RateLimitState | null }>(
        "SELECT state FROM rate_limits WHERE key = $(key) FOR UPDATE",
        { key }
      )

      const previousState = existingRow?.state ?? null
      const { state, result } = computeNextState(previousState, config, now)

      await transaction.none("UPDATE rate_limits SET state = $(state) WHERE key = $(key)", {
        key,
        state: JSON.stringify(state)
      })

      return result
    })
  }
}
