import express from "express";
import { env } from "./env";
import { connect } from "./config/db";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth.route";

const app = express();
const port = env.PORT;  


app.use(express.json());
app.use(cookieParser());
app.use("/api/v1/auth",authRouter);

const main = async() => {
    try {
        await connect();

        app.listen(port,() => {
            console.log(`User service running on PORT ${port}`);
        })
    } catch(e: any)  {
        console.error(`Failed to start service: ${e.message}`);
        process.exit(1);
    }
}

main();