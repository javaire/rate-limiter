import { NextFunction, Request, Response } from "express"
import { getClient } from "../config/clients"

export function parseBearerToken(header?: string): string | null {
  if (!header) {
    return null
  }
  const bearerMatch = /^Bearer\s+(.+)$/i.exec(header.trim())

  return bearerMatch ? bearerMatch[1].trim() : null
}

export function auth(req: Request, res: Response, next: NextFunction): void {
  const clientId = parseBearerToken(req.header("authorization"))
  const clientConfig = clientId ? getClient(clientId) : undefined

  if (!clientId || !clientConfig) {
    console.warn(`[auth] 401 unauthorized ${req.method} ${req.path}`)
    res.status(401).json({ error: "unauthorized" })
    return
  }

  req.client = { id: clientId, ...clientConfig }
  next()
}
