import nodemailer from "nodemailer";
import { env } from "./env";

type OTPType = "VERIFY_EMAIL" | "RESET_PASSWORD";

const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
    },
});

export const sendOtpEmail = async (to: string,otp: string,type: OTPType) => {
    const isReset = type === "RESET_PASSWORD";

    await transporter.sendMail({
        from: `"Metaverse Security" <${env.SMTP_USER}>`,
        to,
        subject: isReset
            ? "Your Password Reset OTP"
            : "Your Email Verification OTP",
        html: `
            <div style="font-family: sans-serif; padding: 20px;">
                <h2>${isReset ? "Password Reset" : "Email Verification"}</h2>
                <p>
                    Your OTP is:
                    <strong style="font-size: 24px;">${otp}</strong>
                </p>
                <p>This code expires in 5 minutes.</p>
                ${
                    isReset
                        ? "<p>If you did not request a password reset, ignore this email and secure your account if necessary.</p>"
                        : "<p>Use this code to verify your email address.</p>"
                }
            </div>
        `,
    });
};