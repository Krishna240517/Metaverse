import jwt from "jsonwebtoken";
import crypto from "crypto";
import type { Response } from "express";
import { env } from "../env";



const ACCESS_SECRET = env.ATS;
const REFRESH_SECRET = env.RTS;

if(!ACCESS_SECRET || !REFRESH_SECRET) {
    throw new Error("JWT_ACCESS and REFRESH must be defined");
} 

export const signAccessToken = (userId: string) => {
    return jwt.sign({userId},ACCESS_SECRET,{expiresIn: "5m"});
}

export const signRefreshToken = (userId: string) => {
    return jwt.sign({userId},REFRESH_SECRET,{expiresIn: "7d"});
}

export const setRefreshToken = (res: Response, token: string) => {
    res.cookie("token",token, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite:"strict" as const,
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
};

export const clearRefreshToken = (res: Response) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "strict" as const
    })
};

export const hashToken = (token: string) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};