const Stripe = require("stripe");
const { ENV } = require("../config");

const stripeKey =
  ENV === "dev"
    ? process.env.STRIPE_SECRET_KEY_TEST
    : process.env.STRIPE_SECRET_KEY_LIVE;

const stripe = new Stripe(stripeKey, {
  apiVersion: "2024-06-20",
});

async function verifyStripePayment(payment) {
  const paymentIntentId = payment.stripePaymentIntentId;

  if (!paymentIntentId) {
    throw new Error("PaymentIntent ID missing");
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      {
        expand: ["payment_method", "charges.data.balance_transaction"],
      }
    );

    if (!paymentIntent) {
      throw new Error("PaymentIntent not found");
    }

    if (paymentIntent.status !== "succeeded") {
      throw new Error("Payment not successful");
    }

    const charge = paymentIntent.charges?.data?.[0] || {};
    const pm = paymentIntent.payment_method || {};

    return {
      status: "success",
      normalizedData: {
        paidAt: new Date(paymentIntent.created * 1000),
        channel: pm.type || "card",
        currency: paymentIntent.currency?.toUpperCase(),
        transactionDate: paymentIntent.created,
        log: [
          {
            id: paymentIntent.id,
            type: "payment_intent.succeeded",
            created: new Date(paymentIntent.created * 1000),
          },
        ],
        fees: charge.balance_transaction?.fee || 0,
        cardType: pm.card?.brand || "",
        bank: pm.card?.funding || "",
        countryCode: pm.card?.country || "",
        gatewayResponse: charge.outcome?.seller_message || "",
        gateway: "stripe",
      },
    };
  } catch (error) {
    throw new Error(
      error.message || "Failed to verify Stripe payment. Please try again."
    );
  }
}

module.exports = {
  verifyStripePayment,
};
