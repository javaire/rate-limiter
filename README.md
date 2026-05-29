# Rate Limiter API

Small Node + Express + TypeScript API demonstrating API throttling. It exposes two GET
endpoints, each protected by a **different rate-limiting algorithm**, with
**per-client limits** and **two interchangeable stores** selected via the `STORE` .env var.

- `GET /foo` -> Token Bucket
- `GET /bar` -> Sliding Window Counter
- Auth: `Authorization: Bearer <client-id>`
- `200 { "success": true }` under the limit, `429 { "error": "rate limit exceeded" }` once reached

## Architecture

```
client --(GET /foo, Authorization: Bearer <client-id>)--> [auth middleware]
   -> valid client?  --no--> 401 { error: "unauthorized" }
   -> yes -> [rateLimit middleware] -> store.consume("foo:<client-id>", config, now)
        -> allowed?  --yes--> 200 { success: true }
                     --no---> 429 { error: "rate limit exceeded" }  (+ Retry-After)
        -> store unreachable --> fail-open (allow + console.warn)
```

Both backends implement one `RateLimitStore` interface and are chosen at boot via `STORE`
(`memory` = Redis, `persistent` = Postgres), so the rest of the app is backend-agnostic.

## Clients

Clients and limits live in [`src/config/clients.ts`](src/config/clients.ts):

| Client     | `/foo` (Token Bucket)        | `/bar` (Sliding Window Counter) |
| ---------- | ---------------------------- | ------------------------------- |
| `client-1` | capacity 5, refill 1/s       | 10 requests / 60s               |
| `client-2` | capacity 2, refill 0.5/s     | 3 requests / 60s                |

Any other client id returns `401`. Limits apply **per client, per endpoint**
(`key = endpoint:clientId`) — not per IP and not globally — so each endpoint keeps its own
counter.

## Running

Requires **Node 22 LTS** (see `.nvmrc`).

### Docker Compose (runs both stores)

```bash
docker compose up --build                  # memory / Redis-backed (default)
STORE=persistent docker compose up --build # persistent / Postgres-backed
```

The API listens on `http://localhost:3000`. Redis and Postgres run as separate services so
you can switch strategies via `STORE`.

### Tests

```bash
npm install
npm test
```

No external services needed: algorithms are unit-tested directly, and HTTP behavior is
integration-tested with an in-process `FakeStore` reusing the same pure algorithms.

## Trying it out

```bash
# allowed
curl -i "http://localhost:3000/foo" -H "Authorization: Bearer client-1"   # 200 { success: true }

# throttled (repeat past the limit)
for i in $(seq 1 6); do
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/foo" -H "Authorization: Bearer client-1"
done                                                                       # 200 200 200 200 200 429

# missing/invalid auth
curl -i "http://localhost:3000/foo"                                        # 401 Unauthorized
```

## Design decisions

### Algorithms (constant memory)

Both keep **O(1) state per key**, so memory stays constant regardless of traffic. This avoids
the **Sliding Window Log**, which stores one timestamp per request and grows **O(N)**.

- **Token Bucket** (`/foo`) — `{ tokens, lastRefillMs }`. Allows bursts up to `capacity`,
  refilling at `refillRatePerSec`.
- **Sliding Window Counter** (`/bar`) — `{ currentCount, previousCount, windowStartMs }`.
  Weights the previous window's count by the fraction still in the rolling window —
  near-precise limiting at constant memory.

### Storage (both distributed-capable)

Counters live in a shared external store so limits are enforced **globally** across API
instances (an in-process map can't coordinate behind a load balancer).

- **`memory` — Redis** (`MemoryStore`) — RAM, sub-millisecond, made atomic with a Lua script
  (read-modify-write in one round trip) plus `PEXPIRE` for auto-expiry. Scripts are registered
  via ioredis `defineCommand` and run with `EVALSHA`.
- **`persistent` — Postgres** (`PersistentStore`, via `pg-promise`) — shared ACID table. Each
  request runs `db.tx(...)` with `SELECT ... FOR UPDATE`, recomputes via the same pure
  functions, and upserts. Durable, at the cost of a transaction + row lock per request.

Both prevent lost updates under concurrency. If the store is unreachable, the middleware
**fails open** so a limiter outage doesn't take down the API.

**Production note:** Postgres is used here to show correct atomic limiting in a relational
engine, but rate limiting is more typically done with **Redis (AOF persistence)** since
counters are ephemeral and self-healing. Postgres-grade durability is only worth it for
sensitive/auditable operations (payments, auth attempts, quota billing).

### Stack

- **TypeScript** for type safety on the store interface and algorithm state.
- **Express** for a clean middleware model (auth + rate limiting).
- **ioredis** / **pg-promise** — mature clients for the two stores.
- **Jest + ts-jest + supertest** — unit + HTTP tests with no external services.
- **npm** — ships with Node, reproducible via `package-lock.json`.
- **Node 22 LTS** — pinned via `.nvmrc` + `engines`.
- **Explicit `tsc` build** — type-checked, deterministic JS everywhere (Node's built-in TS
  support only strips types without checking).

## Deployment (Render, free tier)

A [`render.yaml`](render.yaml) blueprint provisions a free Docker web service plus a free
Postgres instance (`STORE=persistent`):

1. Push this repo to GitHub.
2. In Render: **New > Blueprint**, point it at the repo, and apply.
3. Render builds the Dockerfile, wires `DATABASE_URL` from managed Postgres, and injects `PORT`.

Caveats: the free web service sleeps after ~15 min idle (first request cold-starts), and free
Postgres expires after ~90 days. Both strategies are best demonstrated locally via Docker
Compose; the cloud deployment uses Postgres by default.