import { Redis } from "@upstash/redis";
import { env } from "../env";

export const redis = new Redis({
    url: env.REDIS_URL,
    token: env.REDIS_TOKEN
});


async function testRedisConnection() {
    try {
        const res = await redis.ping();
        if(res === "PONG") {
            console.log("✅ Successfully connected to Upstash Redis!");
        }
    } catch(error) {
        console.error("❌ Failed to connect to Redis:", error);
    }
};

testRedisConnection();
