import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env";

declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: string
            }
        }
    }
};

interface JwtPayload {
    userId: string;
}

export const protect = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if(!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({msg:"Unauthorized Access"});
        return;
    }

    const token = authHeader.split(' ')[1];
    if(!token) {
        res.status(401).json({
            msg:"Unauthorized access"
        })
        return;
    }

    
    try {
        const decoded = jwt.verify(token,env.ATS) as JwtPayload;

        req.user = {
            userId: decoded.userId
        };

        next();
    } catch(e) {
        if (e instanceof jwt.TokenExpiredError) {
            res.status(401).json({
                msg: "Access token has expired.",
                code: "TOKEN_EXPIRED"
            });
            return;
        }
        res.status(401).json({
            msg: "Access token is invalid",
            code: "TOKEN_INVALID"
        })
    }
}