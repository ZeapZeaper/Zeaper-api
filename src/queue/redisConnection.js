// queue/redisConnection.js
const IORedis = require("ioredis");

const connection = new IORedis({
  host: "redis-19442.c243.eu-west-1-3.ec2.redns.redis-cloud.com",
  port: 19442,
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // IMPORTANT for BullMQ
});

connection.on("connect", () => {
  console.log("✅ BullMQ Redis connected");
});

connection.on("error", (err) => {
  console.error("❌ BullMQ Redis error:", err);
});

module.exports = connection;
