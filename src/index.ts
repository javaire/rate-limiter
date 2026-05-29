import { createApp } from "./app"
import { createRateLimitStore } from "./rateLimit/factory"
import { StorageStrategy } from "./rateLimit/types"

async function main(): Promise<void> {
  const store = createRateLimitStore()
  await store.init()

  const app = createApp(store)
  const port = Number(process.env.PORT ?? 3000)
  const server = app.listen(port, () => {
    console.log(`API throttling listening on :${port}`)
  })

  const shutdown = async (): Promise<void> => {
    server.close()
    await store.close()
    process.exit(0)
  }

  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

main().catch((error) => {
  console.error("failed to start", error)
  process.exit(1)
})
