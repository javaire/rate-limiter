import { Express } from "express"
import request from "supertest"
import { createApp } from "../src/app"
import { FakeStore } from "./fakeStore"

describe("rate limiter API", () => {
  let store: FakeStore
  let app: Express

  beforeEach(() => {
    store = new FakeStore()
    app = createApp(store)
  })

  it("returns 200 {success:true} until the limit, then 429 {error}", async () => {
    for (let i = 0; i < 5; i++) {
      const response = await request(app).get("/foo").set("Authorization", "Bearer client-1")
      expect(response.status).toBe(200)
      expect(response.body).toEqual({ success: true })
    }

    const blocked = await request(app).get("/foo").set("Authorization", "Bearer client-1")
    expect(blocked.status).toBe(429)
    expect(blocked.body).toEqual({ error: "rate limit exceeded" })
  })

  it("rejects missing, malformed, or unknown auth with 401", async () => {
    const noHeader = await request(app).get("/foo")
    expect(noHeader.status).toBe(401)

    const malformed = await request(app).get("/foo").set("Authorization", "client-1")
    expect(malformed.status).toBe(401)

    const unknownClient = await request(app).get("/foo").set("Authorization", "Bearer does-not-exist")
    expect(unknownClient.status).toBe(401)
  })

  it("enforces independent, per-client limits", async () => {
    for (let i = 0; i < 2; i++) {
      const response = await request(app).get("/foo").set("Authorization", "Bearer client-2")
      expect(response.status).toBe(200)
    }
    const blocked = await request(app).get("/foo").set("Authorization", "Bearer client-2")
    expect(blocked.status).toBe(429)

    const otherClient = await request(app).get("/foo").set("Authorization", "Bearer client-1")
    expect(otherClient.status).toBe(200)
  })

  it("rate limits /bar independently from /foo", async () => {
    const foo = await request(app).get("/foo").set("Authorization", "Bearer client-2")
    expect(foo.status).toBe(200)

    const bar = await request(app).get("/bar").set("Authorization", "Bearer client-2")
    expect(bar.status).toBe(200)
  })
})
