import { EndpointConfig, RateLimitAlgorithm } from "../rateLimit/types"

export type Endpoint = "foo" | "bar"

export interface ClientConfig {
  foo: EndpointConfig
  bar: EndpointConfig
}

export type Client = { id: string } & ClientConfig

export const clients: Record<string, ClientConfig> = {
  "client-1": {
    foo: {
      algorithm: RateLimitAlgorithm.TokenBucket,
      capacity: 5,
      refillRatePerSec: 1
    },
    bar: {
      algorithm: RateLimitAlgorithm.SlidingWindowCounter,
      limit: 10,
      windowMs: 60_000
    }
  },
  "client-2": {
    foo: {
      algorithm: RateLimitAlgorithm.TokenBucket,
      capacity: 2,
      refillRatePerSec: 0.5
    },
    bar: {
      algorithm: RateLimitAlgorithm.SlidingWindowCounter,
      limit: 3,
      windowMs: 60_000
    }
  }
}

export function getClient(clientId: string): ClientConfig | undefined {
  return clients[clientId]
}

export const endpoints: Endpoint[] = ["foo", "bar"]

export function rateLimitKey(endpoint: Endpoint, clientId: string): string {
  return `${endpoint}:${clientId}`
}

export function allRateLimitKeys(): string[] {
  return Object.keys(clients).flatMap((clientId) =>
    endpoints.map((endpoint) => rateLimitKey(endpoint, clientId))
  )
}
