// workers/testWorker.js
const { Worker } = require("bullmq");
const connection = require("../queue/redisConnection");

new Worker(
  "orderQueue",
  async (job) => {
    console.log("🟢 Job received:", job.name, job.data);

    // simulate async work
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log("✅ Job completed:", job.id);
  },
  { connection }
);

console.log("👷 Test worker running...");
