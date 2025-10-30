// redisClient.js
const { createClient } = require("redis");

const redis = createClient({
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: "redis-19442.c243.eu-west-1-3.ec2.redns.redis-cloud.com",
    port: 19442,
  },
});

redis.on("connect", () => console.log("✅ Connected to Redis Cloud"));
redis.on("error", (err) => console.error("❌ Redis error:", err));

redis.connect();

module.exports = redis;
