import { z } from "zod";

export const signUpSchema = z.object({
    name: z.string().trim().min(2, "A Unique Avatar Name is Required"),
    email: z.email('Invalid Email Address').trim().toLowerCase(),
    password: z.string().min(8, "Password must be atleast 8 characters")
        .regex(/[a-z]+/, "Password must contain atleast one lowercase letter")
        .regex(/[A-Z]+/, "Password must contain atleast one uppercase letter")
        .regex(/[0-9]+/, "Password must contain digits")
        .regex(/[!@#$%^&*_-]+/, "Password must contain atleast one special character")
});


export const loginSchema = z.object({
    email: z.email('Invalid Email Address').trim().toLowerCase(),
    password: z.string()
});