import express from "express";
import { validate } from "../middlewares/validator";
import { loginSchema, signUpSchema } from "../middlewares/schema";
import { authLimiter, otpLimiter, standardLimiter } from "../config/rate-limitter/sliding.window.counter";
import { login, logout, me, signup, verifyOTP, verifyResetOTP, forgotPassword, resetPassword } from "../controllers/auth.controller";
import { protect } from "../middlewares/auth.middleware";
const router = express.Router();



router.post("/sign-up",authLimiter,validate(signUpSchema),signup);
router.post("/login",authLimiter,validate(loginSchema),login);
router.post("/logout",standardLimiter,logout);
router.post("/me",standardLimiter, protect,me);
router.post("/verify-otp",otpLimiter,verifyOTP);



export default router;