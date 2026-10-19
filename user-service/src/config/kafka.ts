import { Kafka, type Producer } from "kafkajs";
import { z } from "zod";
import { env } from "../env";



const kafkaBrokerSchema = z.string().min(1);


const brokers = kafkaBrokerSchema.parse(env.KAFKA_BROKERS).split(",").map((b) => b.trim()).filter(Boolean)
if(brokers.length === 0) {
    throw new Error("KAFKA_BROKERS must contain at least one broker");
}

const kafka = new Kafka({
    clientId: "user-service",
    brokers,
});

export const producer: Producer = kafka.producer();

export const connectKafkaProducer = async () => {
    await producer.connect();
    console.log("Kafka Producer Connected");
};

export const publishEvent = async (topic: string, key: string, payload: object) => {
    await producer.send({
        topic,
        messages: [
            {
                key,
                value: JSON.stringify(payload)
            }
        ]
    })
};

