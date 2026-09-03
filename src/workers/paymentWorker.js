const { Worker } = require("bullmq");
const PaymentModel = require("../models/payment");
const paymentQueue = require("../queue/paymentQueue");

const worker = new Worker(
  paymentQueue.name,
  async (job) => {
    if (job.name !== "expirePendingPayment") {
      return { skipped: true, reason: "unknown job type" };
    }

    const { paymentId, reference } = job.data || {};

    if (!paymentId || !reference) {
      return { skipped: true, reason: "missing paymentId/reference" };
    }

    const updated = await PaymentModel.findOneAndUpdate(
      {
        _id: paymentId,
        reference,
        status: "pending",
      },
      {
        status: "expired",
        gatewayResponse: "Payment attempt expired",
      },
      { new: true },
    ).lean();

    return { expired: Boolean(updated), paymentId, reference };
  },
  { connection: paymentQueue.opts.connection },
);

worker.on("completed", (job) =>
  console.log("Payment job completed", job.id, job.name),
);
worker.on("failed", (job, err) =>
  console.error("Payment job failed", job?.id, job?.name, err),
);
