// queue/orderQueue.js
const { Queue } = require("bullmq");
const connection = require("./redisConnection");
const { ENV } = require("../config");

const QUEUE_NAME = `orderQueue-${ENV}`;

const orderQueue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    removeOnComplete: {
      age: 60 * 60, // delete after 1 hour
      count: 500, // keep last 500 completed jobs
    },
    removeOnFail: {
      age: 24 * 60 * 60, // delete after 24 hours
      count: 100, // keep last 100 failed jobs
    },
  },
});


module.exports = orderQueue;
