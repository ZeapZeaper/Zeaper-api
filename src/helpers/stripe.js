const Stripe = require("stripe");
const { ENV } = require("../config");
const stripeKey =
  ENV === "dev"
    ? process.env.STRIPE_SECRET_KEY_TEST
    : process.env.STRIPE_SECRET_KEY_LIVE;

const stripe = new Stripe(stripeKey, {
  apiVersion: "2024-06-20", // keep current
});

/**
 * Verifies a Stripe payment by PaymentIntent ID.
 * Returns: { paymentIntent, log }
 */
async function verifyStripePayment(payment) {
  const paymentIntentId = payment.stripePaymentIntentId;

  if (!paymentIntentId) {
    throw new Error("PaymentIntent ID missing");
  }

  try {
    // Retrieve PaymentIntent with full expansion
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

    // Fetch logs
    const events = await stripe.events.list({ limit: 50 });
    const filteredEvents = events.data.filter(
      (event) => event.data.object?.id === paymentIntent.id
    );

    const log = filteredEvents.map((event) => ({
      id: event.id,
      type: event.type,
      created: new Date(event.created * 1000),
      data: event.data.object,
    }));

    // Extract data for DB
    const paymentMethod = paymentIntent.payment_method;
    const charge = paymentIntent.charges?.data?.[0] || null;

    return {
      status: "success",
      paidAt: new Date(paymentIntent.created * 1000),
      channel: paymentMethod?.type || "card",
      currency: paymentIntent.currency?.toUpperCase(),
      transactionDate: paymentIntent.created,
      log,
      fees: charge?.balance_transaction?.fee || 0,
      cardType: paymentMethod?.card?.brand || "",
      bank: paymentMethod?.card?.funding || "",
      countryCode: paymentMethod?.card?.country,
      gatewayResponse: charge?.outcome?.seller_message || "",
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
