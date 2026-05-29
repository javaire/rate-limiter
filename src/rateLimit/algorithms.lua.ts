// reference: https://github.com/redis-developer/redis-ratelimiting-js/blob/main/server/components/rate-limiting/token-bucket.ts
export const tokenBucketScript = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillPerMs = tonumber(ARGV[2]) / 1000
local now = tonumber(ARGV[3])

local data = redis.call('HMGET', key, 'tokens', 'lastRefillMs')
local tokens = tonumber(data[1])
local lastRefillMs = tonumber(data[2])
if tokens == nil then
  tokens = capacity
  lastRefillMs = now
end

local elapsed = now - lastRefillMs
if elapsed < 0 then elapsed = 0 end
tokens = math.min(capacity, tokens + elapsed * refillPerMs)

local allowed = 0
local retryAfterMs = 0
if tokens < 1 then
  if refillPerMs > 0 then
    retryAfterMs = math.ceil((1 - tokens) / refillPerMs)
  end
else
  allowed = 1
  tokens = tokens - 1
end

redis.call('HSET', key, 'tokens', tokens, 'lastRefillMs', now)
if refillPerMs > 0 then
  redis.call('PEXPIRE', key, math.ceil(capacity / refillPerMs))
end

return {allowed, retryAfterMs}
`

//reference: https://github.com/redis-developer/redis-ratelimiting-js/blob/main/server/components/rate-limiting/sliding-window-counter.ts
export const slidingWindowCounterScript = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local windowStartMs = math.floor(now / windowMs) * windowMs

local data = redis.call('HMGET', key, 'currentCount', 'previousCount', 'windowStartMs')
local currentCount = tonumber(data[1])
local previousCount = tonumber(data[2])
local storedWindowStart = tonumber(data[3])
if currentCount == nil then
  currentCount = 0
  previousCount = 0
  storedWindowStart = windowStartMs
end

if windowStartMs ~= storedWindowStart then
  local advanced = (windowStartMs - storedWindowStart) / windowMs
  if advanced == 1 then
    previousCount = currentCount
    currentCount = 0
  else
    previousCount = 0
    currentCount = 0
  end
  storedWindowStart = windowStartMs
end

local elapsedInWindow = now - windowStartMs
local previousWeight = (windowMs - elapsedInWindow) / windowMs
local estimate = currentCount + previousCount * previousWeight

local allowed = 0
local retryAfterMs = 0
if estimate >= limit then
  retryAfterMs = windowMs - elapsedInWindow
else
  allowed = 1
  currentCount = currentCount + 1
end

redis.call('HSET', key, 'currentCount', currentCount, 'previousCount', previousCount, 'windowStartMs', storedWindowStart)
redis.call('PEXPIRE', key, windowMs * 2)

return {allowed, retryAfterMs}
`
