import { NextFunction, Request, Response } from "express"
import { Endpoint, rateLimitKey } from "../config/clients"
import { RateLimitStore } from "../rateLimit/types"

export function rateLimit(store: RateLimitStore, endpoint: Endpoint) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const client = req.client
    if (!client) {
      res.status(401).json({ error: "unauthorized" })
      return
    }

    const config = client[endpoint]
    const key = rateLimitKey(endpoint, client.id)

    try {
      const result = await store.consume(key, config, Date.now())
      if (!result.allowed) {
        if (Number.isFinite(result.retryAfterMs) && result.retryAfterMs > 0) {
          res.setHeader("Retry-After", Math.ceil(result.retryAfterMs / 1000))
        }
        console.warn(`[rate-limit] 429 exceeded ${key}`)
        res.status(429).json({ error: "rate limit exceeded" })
        return
      }

      console.log(`[rate-limit] 200 allowed ${key}`)
      next()
    } catch (error) {
      console.warn(`rate limiter store error for ${key}, failing open`, error)
      next()
    }
  }
}
