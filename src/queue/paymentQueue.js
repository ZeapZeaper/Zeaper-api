const { Queue } = require("bullmq");
const connection = require("./redisConnection");
const { ENV } = require("../config");

const QUEUE_NAME = `paymentQueue-${ENV}`;

const paymentQueue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    removeOnComplete: {
      age: 60 * 60,
      count: 500,
    },
    removeOnFail: {
      age: 24 * 60 * 60,
      count: 100,
    },
  },
});

module.exports = paymentQueue;
