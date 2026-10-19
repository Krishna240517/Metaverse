import { Kafka, type Consumer, type EachMessagePayload } from "kafkajs";
import { env } from "./env";
import { z } from "zod";
import { sendOtpEmail } from "./mailer";

const kafkaBrokerSchema = z.string().min(1);


const brokers = kafkaBrokerSchema.parse(env.KAFKA_BROKERS).split(",").map((b) => b.trim()).filter(Boolean)
if (brokers.length === 0) {
    throw new Error("KAFKA_BROKERS must contain at least one broker");
}

const kafka = new Kafka({
    clientId: "mail-service",
    brokers,
});

export const consumer: Consumer = kafka.consumer({
    groupId: "otp-consumer-group"
});


interface OTPPayload {
    email: string;
    otp: string;
    type: "VERIFY_EMAIL" | "RESET_PASSWORD";
    createdAt: number;
    expiresInSeconds: number;
    channel: "email";
}


export const startOtpConsumer = async (topic: string = "send-otp") => {
    await consumer.connect();
    console.log("Kafka Consumer connected");


    await consumer.subscribe({ topic, fromBeginning: false });

    await consumer.run({
        eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
            if (!message.value) {
                console.error("Received empty Kafka message");
                return;
            }

            try {
                const payload = JSON.parse(message.value.toString()) as OTPPayload;

                if (!payload.email || !payload.otp || !["VERIFY_EMAIL", "RESET_PASSWORD"].includes(payload.type) || payload.channel !== "email") {
                    throw new Error("Invalid OTP payload");
                }

                const ageInSeconds =
                    (Date.now() - payload.createdAt) / 1000;

                if (ageInSeconds >= payload.expiresInSeconds) {
                    console.warn(`Expired OTP event skipped: ${payload.email}`);
                    return;
                }

                await sendOtpEmail(payload.email, payload.otp,payload.type);

                console.log(`OTP email sent successfully to ${payload.email} from ${topic}, partition ${partition}`);
            } catch (e) {
                console.error("Failed to process OTP event:", e);
                throw e;
            }
        }
    });

    console.log(`Listening for OTP events on topic: ${topic}`)
};