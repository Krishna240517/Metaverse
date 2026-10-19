import fs from "fs";
import { redis } from "../redis";
import type { Request, Response, NextFunction } from "express";

// Ensure your tsconfig.json has "target": "ES2022" or higher to support top-level await
const lua = fs.readFileSync("./sliding.window.counter.lua", "utf8");

const sha = await redis.scriptLoad(lua);



export function createSlidingLimiter(options: {limit: number; windowMs: number; contextName: string;}) {
    const { limit, windowMs, contextName } = options;

    return async function (req: Request, res: Response, next: NextFunction) {
        const forwarded = req.headers['x-forwarded-for'];
        const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded) || req.socket.remoteAddress || "127.0.0.1";

        const now = Date.now();
        const currentWindow = Math.floor(now / windowMs);
        const previousWindow = currentWindow - 1;

        const currentKey = `sw:${contextName}:${ip}:${currentWindow}`;
        const previousKey = `sw:${contextName}:${ip}:${previousWindow}`;

        try {
            const [allowed, count] = await redis.evalsha(sha,[currentKey,previousKey],[limit.toString(), windowMs.toString()]) as [number, number];
            if(!allowed) {
                return res.status(429).json({
                    success: false,
                    message: `Too many requests for ${contextName}. Please try again later`,
                    requests: count
                })
            }

            (req as any).requests = count;
            next();
        } catch (e) {
            console.error(`Rate limitter error on ${contextName}: `,e);
            next();
        }
    }
};

export const otpLimiter = createSlidingLimiter({
    contextName:"otp",
    limit: 3,
    windowMs: 60 * 1000
});

export const authLimiter = createSlidingLimiter({
    contextName: "auth",
    limit: 15,
    windowMs: 60 * 1000
});

export const standardLimiter = createSlidingLimiter({
    contextName: "standard",
    limit: 100,
    windowMs: 60 * 1000
});