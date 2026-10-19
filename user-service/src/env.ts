import "dotenv/config";

export const env = {
    DB_URL: process.env.DATABASE_URL!,
    ATS: process.env.ACCESS_TOKEN_SECRET!,
    RTS: process.env.REFRESH_TOKEN_SECRET!,
    PORT: process.env.PORT!,
    REDIS_URL: process.env.REDIS_URL!,
    REDIS_TOKEN: process.env.REDIS_TOKEN!,
    NODE_ENV: process.env.NODE_ENV!,
    KAFKA_BROKERS: process.env.KAFKA_BROKERS,  
};
