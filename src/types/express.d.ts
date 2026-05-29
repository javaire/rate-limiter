import type { Client } from "../config/clients"

declare global {
  namespace Express {
    interface Request {
      client?: Client
    }
  }
}

export {}
