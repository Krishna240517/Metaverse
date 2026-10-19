import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "../../node_modules/@types/pg";
import { env } from "../env";

const connectionString = env.DB_URL;

const pool = new Pool({connectionString});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({adapter});

export async function connect() {
    await prisma.$connect();
    console.log("Successfully Connected to Prisma");
}
