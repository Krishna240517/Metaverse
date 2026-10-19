-- KEYS[1] = current window key
-- KEYS[2] = previous window key
-- ARGV[1] = limit
-- ARGV[2] = window size (milliseconds)
-- ARGV[3] = current timestamp

local currentKey = KEYS[1]
local previousKey = KEYS[2]

local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

-- 1. Calculate the exact fraction of the previous window that slides into the current one
local elapsed = now % window
local overlapFraction = (window - elapsed) / window

-- 2. Read counters (Fetching previous window count)
local previousCount = tonumber(redis.call("GET", previousKey)) or 0
local currentCount = tonumber(redis.call("GET", currentKey)) or 0

-- 3. Calculate what the total count *would* be if we allowed this request
local projectedCount = currentCount + (previousCount * overlapFraction)

-- 4. Check limit BEFORE incrementing to keep numbers clean
if projectedCount >= limit then
    -- Return 0 (blocked) and the current projected count
    return { 0, math.floor(projectedCount) }
end

-- 5. If allowed, increment atomically and set/refresh TTL
local newCurrentCount = redis.call("INCR", currentKey)
if newCurrentCount == 1 then
    -- Only set expiration on the first increment to reduce write load
    redis.call("PEXPIRE", currentKey, window * 2)
end

-- Return 1 (allowed) and the updated total count
local finalCount = newCurrentCount + (previousCount * overlapFraction)
return { 1, math.floor(finalCount) }
