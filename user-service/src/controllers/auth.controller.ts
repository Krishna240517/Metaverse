import { prisma } from "../config/db";
import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto"
import { clearRefreshToken, hashToken, setRefreshToken, signAccessToken, signRefreshToken } from "../config/token";
import jwt from "jsonwebtoken";
import { env } from "../env";
import { redis } from "../config/redis";
import { publishEvent } from "../config/kafka";


//----------------------------------------HELPER---------------------------------//
interface OTPPayload {
    email: string;
    otp: string;
    type: "VERIFY_EMAIL" | "RESET_PASSWORD";
    createdAt: number;
    expiresInSeconds: number;
    channel:string;
}

const sendOTP = async(email: string,type:"VERIFY_EMAIL" | "RESET_PASSWORD" = "VERIFY_EMAIL") => {
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpKey = `otp:${type}:${email}`;

    await redis.set(otpKey,otp,{ ex: 300});

    const kafkaPayload: OTPPayload = {
        email: email,
        otp:otp,
        type,
        createdAt: Date.now(),
        expiresInSeconds: 300,
        channel:"email"
    }

    await publishEvent("send-otp",email, kafkaPayload);
}
//-----------------------------------------------------------------------------------------//


export const signup = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            res.status(400).json({ msg: "Please provide all field details" });
            return;
        }

        const existing = await prisma.user.findMany({
            where: {
                name
            }
        })

        if (existing) {
            res.status(409).json({ msg: "Email is already registered" });
            return;
        }

        const hashPassword = await bcrypt.hash(password, 10);



        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashPassword
            },
            select: {
                id: true,
                name: true,
                email: true,
            }
        });

        const accessToken = signAccessToken(user.id);
        const refreshToken = signRefreshToken(user.id);

        const hashedRefreshToken = hashToken(refreshToken);

        await prisma.user.update({
            where: {
                name
            },
            data: {
                refreshToken: hashedRefreshToken
            }
        });

        setRefreshToken(res, refreshToken);

        res.status(201).json({
            msg: "Account Created Successfully",
            accessToken: accessToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            }
        })
    } catch (e) {
        console.error("Error in signup controller", e);
        res.status(500).json({ msg: "Internal Server Error" });
        return;
    }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) {
            res.status(400).json({ msg: "Please provide an identifier and password" });
            return;
        }

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { name: identifier }
                ]
            }
        });

        if (!user) {
            res.status(401).json({ msg: "Invalid Credentials" });
            return;
        }

        const matchPassword = await bcrypt.compare(password, user.password);

        if (!matchPassword) {
            res.status(401).json({ msg: "Invalid Credential" });
            return;
        }

        const acccessToken = signAccessToken(user.id);
        const refreshToken = signRefreshToken(user.id);
        const hashedRefreshToken = hashToken(refreshToken);

        await prisma.user.update({
            where: {
                id: user.id
            },
            data: {
                refreshToken: hashedRefreshToken
            }
        });

        setRefreshToken(res, refreshToken);

        res.status(200).json({
            msg: "Logged In Successfully",
            acccessToken: acccessToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });
    } catch (e) {
        console.error("Error in Login controller", e);
        res.status(500).json({ msg: "Internal Server Error" });
        return;
    }
};

export const logout = async (req: Request, res: Response) => {
    const token = req.cookies?.['token'] as string;

    if (token) {
        const incomingHash = hashToken(token);

        const user = await prisma.user.findFirst({
            where: {
                refreshToken: incomingHash
            },
            select: {
                id: true
            }
        });

        if (user) {
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    refreshToken: null
                }
            });
        }

        clearRefreshToken(res);
        res.status(200).json({
            msg: "Logged Out Successfully"
        })
    }
}

export const refresh = async (req: Request, res: Response) => {
    const token = req.cookies?.['token'] as string;

    if (!token) {
        res.status(401).json({
            msg: "No refresh token provided.",
            code: "NO_REFRESH_TOKEN"
        });
        return;
    }

    let decoded: {
        userId: string
    }

    try {
        decoded = jwt.verify(token, env.RTS!) as { userId: string };
    } catch (e) {
        clearRefreshToken(res);
        if (e instanceof jwt.TokenExpiredError) {
            res.status(401).json({
                msg: "Refresh token has expired. Please login Again!!",
                code: "REFRESH_TOKEN_EXPIRED"
            });
            return;
        }

        res.status(401).json({
            msg: "Refresh token is invalid",
            code: "REFRESH_TOKEN_INVALID"
        });
        return;
    }

    const hashRefreshToken = hashToken(token);

    const user = await prisma.user.findUnique({
        where: {
            id: decoded.userId
        },
        select: {
            id: true,
            refreshToken: true
        }
    });

    if (!user) {
        clearRefreshToken(res);
        res.status(401).json({
            msg: "User No longer exists.",
            code: "USER_NOT_FOUND"
        });
        return;
    }
    if (!user.refreshToken) {
        clearRefreshToken(res);
        res.status(401).json({
            msg: "No active session exists.",
            code: "NO_ACTIVE_SESSION"
        });
        return;
    }

    if (user.refreshToken !== hashRefreshToken) {
        await prisma.user.update({
            where: {
                id: user.id
            },
            data: {
                refreshToken: null
            }
        })

        clearRefreshToken(res);
        res.status(401).json({
            msg: "Token mismatch detected. Login again!",
            code: "TOKEN_REUSE_DETECTED"
        });
        return;
    }

    const newRefreshToken = signRefreshToken(user.id);
    const newHashedToken = hashToken(newRefreshToken);


    await prisma.user.update({
        where: {
            id: user.id,
        },
        data: {
            refreshToken: newHashedToken
        }
    });

    setRefreshToken(res, newRefreshToken);

    const newAccessToken = signAccessToken(user.id);

    res.status(200).json({
        msg: "Token successfully refreshed.",
        accessToken: newAccessToken
    });
};


export const me = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;

        const user = await prisma.user.findUnique({
            where: {
                id: userId
            },
            select: {
                name: true,
                email: true
            }
        })

        res.json({ user });
    } catch (e) {
        console.error(e);
        res.status(500).json({
            msg: "Error in me controller"
        });
    }
}

export const verifyOTP = async(req: Request, res: Response) => {
    const { email, otp:enteredOtp } = req.body;
    if(!email || !enteredOtp) {
        return res.status(400).json({ msg: "Email and OTP are required" });
    }

    const otpKey = `otp:${email}`;
    const storedOtp = await redis.get(otpKey);
    if(!storedOtp || storedOtp !== enteredOtp) {
        return res.status(400).json({ msg: "Invalid or expired OTP" });
    }

    const user = await prisma.user.findUnique({
        where: {
            email
        },
        select: {
            isVerified: true,
            password: false,
            refreshToken: false
        }
    });

    if(!user) {
        return res.status(404).json({ msg: "User not found" });
    }
    if(user.isVerified) {
        return res.status(400).json({ msg: "User already verified" });
    }
    //update the user's isVerified status
    await prisma.user.update({
        where: {
            email
        },
        data: {
            isVerified: true
        }
    });


    //todo:publish a user-created topic KAFKA
}


export const forgotPassword = async(req: Request, res: Response) : Promise<void> => {
    try {
        const { email } = req.body;

        if(!email) {
            res.status(400).json({ msg: "Please provide your email" });
            return;
        }

        const user = await prisma.user.findUnique({
            where: {
                email
            },
            select: {
                isVerified: true
            }
        });

        if(!user) {
            res.status(404).json({ msg: "User not found" });
            return;
        }

        if(!user.isVerified) {
            res.status(403).json({ msg: "Your email is not verified. Please verify your email first before resetting your password" });
            return;
        }
        
        
        await sendOTP(email, "RESET_PASSWORD");


        res.status(200).json({
            msg:"OTP sent to your email. Please verify to proceed"
        })
    } catch (e) {
        console.error("Error in forgotPassword controller", e);
        res.status(500).json({ msg: "Internal Server Error" });
    }
};

export const verifyResetOTP = async(req: Request, res: Response): Promise<void> => {
    try {
        const { email, otp: enteredOtp } = req.body;

        if (!email || !enteredOtp) {
            res.status(400).json({ msg: "Email and OTP are required" });
            return;
        }

        const otpKey = `otp:RESET_PASSWORD:${email}`;
        const storedOtp = await redis.get(otpKey);
        if(!storedOtp || storedOtp !== enteredOtp) {
            res.status(400).json({ msg: "Invalid or expired OTP" });
            return;
        }

        await redis.del(otpKey);

        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetSessionKey = `resetSession:${email}`;

        await redis.set(resetSessionKey, resetToken, {ex: 300});

        res.status(200).json({
            msg:"OTP verified. You may now enter your new password.",
            resetToken
        });
    } catch(e) {
        console.error("Error in verifyResetOTP controller", e);
        res.status(500).json({ msg: "Internal Server Error" });
    }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, resetToken, newPassword, confirmPassword } = req.body;

        if (!email || !resetToken || !newPassword || !confirmPassword) {
            res.status(400).json({ msg: "All fields are required" });
            return;
        }

        if (newPassword !== confirmPassword) {
            res.status(400).json({ msg: "New password and confirm password do not match" });
            return;
        }

        if (newPassword.length < 6) {
            res.status(400).json({ msg: "Password must be at least 6 characters long" });
            return;
        }

        const resetSessionKey = `reset_session:${email}`;
        const storedResetToken = await redis.get(resetSessionKey);

        if (!storedResetToken || storedResetToken !== resetToken) {
            res.status(403).json({
                msg: "Reset session expired or unauthorized. Please verify your email again.",
            });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, isVerified: true, password: true },
        });

        if (!user || !user.isVerified) {
            res.status(403).json({ msg: "Unauthorized or unverified account" });
            return;
        }

        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            res.status(400).json({ msg: "New password cannot be the same as your old password" });
            return;
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                refreshToken: null,
            },
        });

        await redis.del(resetSessionKey);


        clearRefreshToken(res);

        res.status(200).json({
            msg: "Password has been reset successfully. Please login with your new password.",
        });
    } catch (e) {
        console.error("Error in resetPassword controller", e);
        res.status(500).json({ msg: "Internal Server Error" });
    }
};