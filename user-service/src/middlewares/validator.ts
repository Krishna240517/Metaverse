import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export const validate = (schema: any) => async (req: Request, res: Response, next: NextFunction) => {
    try {
        const parseBody = await schema.parseAsync(req.body);
        req.body = parseBody;
        next();
    } catch (e) {
        if (e instanceof ZodError) {
            res.status(400).json({
                msg: "Validation Failed",
                error: e.message
            });
        } else {
            res.status(400).json({
                msg: "An unexpected error occured"
            });
        }
    }
};
