import dotenv from "dotenv";
dotenv.config({path:"../.env"});

export const env = {
    PORT: process.env.PORT!,
    KAFKA_BROKERS: process.env.KAFKA_BROKERS!,
    SMTP_USER: process.env.SMTP_USER!,
    SMTP_PASS: process.env.SMTP_PASS!,
}