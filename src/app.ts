import express, { Express } from "express"
import { auth } from "./middleware/auth"
import { rateLimit } from "./middleware/rateLimit"
import { RateLimitStore } from "./rateLimit/types"

export function createApp(store: RateLimitStore): Express {
  const app = express()

  app.get("/foo", auth, rateLimit(store, "foo"), (_req, res) => {
    res.status(200).json({ success: true })
  })

  app.get("/bar", auth, rateLimit(store, "bar"), (_req, res) => {
    res.status(200).json({ success: true })
  })

  return app
}
