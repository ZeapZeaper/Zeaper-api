const PaymentModel = require("../models/payment");
const BasketModel = require("../models/basket");
const { ENV } = require("./../config");
const {
  calculateTotalBasketPrice,
  currencyConversion,
  covertToNaira,
  detectDeviceType,
} = require("../helpers/utils");
const request = require("request");
const { getAuthUser } = require("../middleware/firebaseUserAuth");
const { createOrder } = require("./order");
const OrderModel = require("../models/order");
const ProductOrderModel = require("../models/productOrder");
const { notifyShop } = require("./notification");
const Stripe = require("stripe");
const { allowedDeliveryCountries } = require("../helpers/constants");
const ShopModel = require("../models/shop");
const { verifyStripePayment } = require("../helpers/stripe");
const { verifyPaystackPayment } = require("../helpers/paystack");
const orderQueue = require("../queue/orderQueue");

const secretKey =
  ENV === "dev"
    ? process.env.PAYSTACK_SECRET_TEST_KEY
    : process.env.PAYSTACK_SECRET_LIVE_KEY;

const stripeKey =
  ENV === "dev"
    ? process.env.STRIPE_SECRET_KEY_TEST
    : process.env.STRIPE_SECRET_KEY_LIVE;

const stripe = new Stripe(stripeKey, {
  apiVersion: "2024-06-20", // keep current
});
const stripewebhookSecret =
  ENV === "dev"
    ? process.env.STRIPE_WEBHOOK_SECRET_TEST
    : process.env.STRIPE_WEBHOOK_SECRET_LIVE;

const generateReference = (param = {}) => {
  const { firstName = "", lastName = "", basketId = "0" } = param;

  const firstChar = firstName.trim().charAt(0).toUpperCase() || "X";
  const lastChar = lastName.trim().charAt(0).toUpperCase() || "X";

  return `${firstChar}${lastChar}-${basketId}-${Date.now()}`;
};

const getStripeClientSecret = async (
  amount,
  currency,
  reference,
  basketId,
  userId
) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method_types: ["card"],
      metadata: { reference, basketId, userId },
    });

    return {
      stripeClientSecret: paymentIntent.client_secret,
      stripePaymentIntentId: paymentIntent.id,
    };
  } catch (error) {
    console.error("Error creating Stripe payment intent:", error);
    throw new Error("Failed to create payment intent");
  }
};

const getReference = async (req, res) => {
  try {
    const {
      basketId,
      firstName,
      lastName,
      country,
      region,
      address,
      phoneNumber,
      postCode,
      method,
    } = req.query;

    // --- 1️⃣ Validate delivery details ---
    const requiredFields = {
      firstName,
      lastName,
      country,
      region,
      address,
      phoneNumber,
      method,
    };
    for (const [key, value] of Object.entries(requiredFields)) {
      if (!value) {
        return res
          .status(400)
          .send({ error: `required ${key} in delivery details` });
      }
    }

    if (!["standard", "express"].includes(method)) {
      return res
        .status(400)
        .send({ error: "delivery method must be either standard or express" });
    }

    if (!allowedDeliveryCountries.includes(country)) {
      return res.status(400).send({
        error: `country not supported. Supported countries are ${allowedDeliveryCountries.join(
          ", "
        )}`,
      });
    }

    const deliveryDetails = {
      address,
      region,
      country,
      phoneNumber,
      firstName,
      lastName,
      postCode,
    };

    // --- 2️⃣ Get authenticated user ---
    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (!authUser) return res.status(400).send({ error: "User not found" });
    if (authUser.disabled)
      return res.status(400).send({ error: "User is disabled" });
    if (authUser.isGuest && !authUser.email) {
      return res
        .status(400)
        .send({ error: "As a guest, update email for receipt and contact" });
    }

    // --- 3️⃣ Find basket ---
    const basketQuery = basketId ? { basketId } : { user: authUser._id };
    const basket = await BasketModel.findOne(basketQuery)
      .populate("user")
      .lean();
    if (!basket) return res.status(404).send({ error: "Basket not found" });

    const user = basket.user;
    if (
      basketId &&
      !authUser.isAdmin &&
      !authUser.superAdmin &&
      user._id.toString() !== authUser._id.toString()
    ) {
      return res
        .status(400)
        .send({ error: "Unauthorized to make payment for this basket" });
    }

    // --- 4️⃣ Determine currency and device ---
    const currency = authUser.prefferedCurrency || "NGN";
    const deviceType = detectDeviceType(req);

    // --- 5️⃣ Check if payment exists ---
    let payment = await PaymentModel.findOne({ basket: basket._id }).lean();
    let reference =
      payment?.reference ||
      generateReference({
        firstName: user.firstName,
        lastName: user.lastName,
        basketId: basket.basketId,
      });
    let stripeClientSecret = payment?.stripeClientSecret || null;
    let stripePaymentIntentId = payment?.stripePaymentIntentId || null;

    // --- 6️⃣ Handle existing payment ---
    if (payment) {
      if (payment.status === "success") {
        // Check if order exists
        let order = await OrderModel.findOne({ payment: payment._id }).lean();

        if (!order) {
          // Process successful payment if order missing
          const processResult = await processSuccessfulPayment(payment);
          order = processResult.order;
        }

        return res.status(200).send({
          message: "Payment already completed",
          data: {
            reference,
            amount: payment.amount,
            currency,
            fullName: payment.fullName,
            email: payment.email,
            paymentStatus: "success",
            orderId: order?.orderId,
            order,
          },
        });
      }
    }

    // --- 7️⃣ Calculate totals for new payment ---
    const calculateTotal = await calculateTotalBasketPrice(
      basket,
      country,
      method
    );
    const amountDue = calculateTotal.total;
    const itemsTotalDue = calculateTotal.itemsTotal;
    const deliveryFeeDue = calculateTotal.deliveryFee;
    const appliedVoucherAmountDue = calculateTotal.appliedVoucherAmount;

    const amount = (await currencyConversion(amountDue, currency)) * 100;
    const itemsTotal =
      (await currencyConversion(itemsTotalDue, currency)) * 100;
    const deliveryFee =
      (await currencyConversion(deliveryFeeDue, currency)) * 100;
    const appliedVoucherAmount =
      (await currencyConversion(appliedVoucherAmountDue, currency)) * 100;
    const total = (
      (await currencyConversion(amountDue, currency)) * 100
    ).toFixed(2);

    const fullName = `${user.firstName} ${user.lastName}`;
    const email = user.email;

    // --- 8️⃣ Handle Stripe client secret if non-NGN ---
    if (currency !== "NGN") {
      const stripeData = await getStripeClientSecret(
        Number(total),
        currency.toLowerCase(),
        reference,
        basket.basketId,
        user.userId
      );
      stripeClientSecret = stripeData.stripeClientSecret;
      stripePaymentIntentId = stripeData.stripePaymentIntentId;
    }

    // --- 9️⃣ Update basket delivery details ---
    await BasketModel.findOneAndUpdate(
      { basketId: basket.basketId },
      { deliveryDetails },
      { new: true }
    );

    // --- 10️⃣ Create new payment if none exists ---
    if (!payment) {
      const newPayment = new PaymentModel({
        reference,
        stripeClientSecret,
        stripePaymentIntentId,
        user: user._id,
        fullName,
        email,
        basket: basket._id,
        status: "pending",
        amount,
        currency,
        itemsTotal,
        deliveryFee,
        total,
        appliedVoucherAmount,
        deliveryMethod: method,
        deviceType,
      });
      await newPayment.save();
    }

    return res.status(200).send({
      message: "Reference fetched successfully",
      data: {
        reference,
        stripeClientSecret,
        amount,
        currency,
        fullName,
        email,
        paymentStatus: "pending",
      },
    });
  } catch (error) {
    console.error("getReference Error:", error);
    res.status(400).send({ error: error.message });
  }
};

const initializePayment = (form, mycallback) => {
  const options = {
    url: "https://api.paystack.co/transaction/initialize",
    headers: {
      authorization: `Bearer ${secretKey}`,
      "content-type": "application/json",
      "cache-control": "no-cache",
    },
    form,
  };

  const callback = (error, response, body) => {
    return mycallback(error, body);
  };
  request.post(options, callback);
};

/**
 * verifyPayment
 * Handles payment verification and enqueues worker tasks for order processing.
 */

const processSuccessfulPayment = async ({
  reference,
  verifiedData, // normalized verification result
  source, // "frontend" | "webhook"
}) => {
  // 1. Fetch payment
  const payment = await PaymentModel.findOne({ reference });
  if (!payment) {
    return { error: "Payment not found" };
  }

  // 2. If already successful, reuse
  let updatedPayment = payment;
  if (payment.status !== "success") {
    updatedPayment = await PaymentModel.findOneAndUpdate(
      { reference },
      {
        status: "success",
        paidAt: verifiedData.paidAt,
        channel: verifiedData.channel,
        currency: verifiedData.currency,
        transactionDate: verifiedData.transactionDate,
        log: verifiedData.log,
        fees: verifiedData.fees,
        cardType: verifiedData.cardType,
        bank: verifiedData.bank,
        countryCode: verifiedData.countryCode,
        gatewayResponse: verifiedData.gatewayResponse,
        gateway: verifiedData.gateway,
      },
      { new: true }
    );
  }

  // 3. STRONGEST DEDUPLICATION (DB)
  let order = await OrderModel.findOne({
    payment: updatedPayment._id,
  }).lean();

  // 4. Compute loyalty points (safe to recompute)
  const currency = updatedPayment.currency || "NGN";
  const amountInKobo = await covertToNaira(updatedPayment.itemsTotal, currency);
  const amountInNaira = amountInKobo / 100;
  const addedPoints = Math.floor(amountInNaira / 1000) * 10;

  if (order) {
    return {
      payment: updatedPayment,
      order,
      addedPoints,
      alreadyProcessed: true,
    };
  }

  // 5. Create order (atomic protection via unique index)
  const createOrderResult = await createOrder({
    payment: updatedPayment,
    user: updatedPayment.user,
    gainedPoints: addedPoints,
  });

  if (createOrderResult.error) {
    return { error: createOrderResult.error };
  }

  order = createOrderResult.order;

  // 6. Queue side effects (QUEUE DEDUPLICATION)
  const workerTasks = createOrderResult.workerTasks || [];
  if (workerTasks.length > 0) {
    await orderQueue.add(
      `processOrder-${reference}`,
      { workerTasks },
      { jobId: reference }
    );
  }

  return {
    payment: updatedPayment,
    order,
    addedPoints,
    alreadyProcessed: false,
  };
};

// controllers/paymentController.js

const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).send({ error: "required reference" });
    }

    // 1. Find payment
    const payment = await PaymentModel.findOne({ reference }).lean();
    if (!payment) {
      return res.status(404).send({
        error: "Payment not found. Please check your reference.",
      });
    }

    // 2. Verify with correct gateway (ONCE)
    let verificationResult;

    if (payment.currency === "NGN") {
      verificationResult = await verifyPaystackPayment(reference);
    } else {
      verificationResult = await verifyStripePayment(payment);
    }

    if (!verificationResult || verificationResult.status !== "success") {
      return res.status(400).send({ error: "Payment not successful" });
    }

    // 3. Process payment (idempotent, race-safe)
    const result = await processSuccessfulPayment({
      reference,
      verifiedData: verificationResult.normalizedData,
      source: "frontend",
    });

    if (result.error) {
      return res.status(400).send({ error: result.error });
    }

    // 4. Return immediately to client
    return res.status(200).send({
      message: "Payment verified successfully",
      data: {
        payment: result.payment,
        order: result.order,
        addedPoints: result.addedPoints,
      },
    });
  } catch (error) {
    console.error("VerifyPayment error:", error);
    return res.status(500).send({ error: error.message });
  }
};

// controllers/stripeWebhook.js

const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, stripewebhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature error:", err.message);
    return res.status(400).send("Webhook error");
  }

  // We only care about successful payments
  if (event.type !== "payment_intent.succeeded") {
    return res.status(200).send({ received: true });
  }

  try {
    const paymentIntent = event.data.object;
    const reference = paymentIntent.metadata?.reference;

    // No reference → nothing to process
    if (!reference) {
      return res.status(200).send({ received: true });
    }

    // Normalize directly from webhook payload
    const normalizedData = await normalizeStripeFromWebhook(paymentIntent);

    // Idempotent processing (safe if frontend already handled it)
    await processSuccessfulPayment({
      reference,
      verifiedData: normalizedData,
      source: "webhook",
    });

    return res.status(200).send({ received: true });
  } catch (error) {
    // IMPORTANT: Always return 200 to avoid Stripe retries
    console.error("Stripe webhook processing error:", error);
    return res.status(200).send({ received: true });
  }
};

const getPayments = async (req, res) => {
  try {
    const payments = await PaymentModel.find()
      .populate("user")
      .lean()
      .sort({ updatedAt: -1 });

    return res.status(200).send({
      data: payments,
      message: "Payments fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const getPayment = async (req, res) => {
  try {
    const { reference } = req.query;
    if (!reference) {
      return res.status(400).send({ error: "required reference" });
    }
    const payment = await PaymentModel.findOne({ reference })
      .lean()
      .populate("user");
    return res.status(200).send({
      data: payment,
      message: "Payment fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const getUserPayments = async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).send({ error: "required user_id" });
    }
    const payments = await PaymentModel.find({ user: user_id }).lean();
    return res.status(200).send({
      data: payments,
      message: "Payments fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const getUserPayment = async (req, res) => {
  try {
    const { user_id, reference } = req.query;
    if (!user_id) {
      return res.status(400).send({ error: "required user_id" });
    }
    if (!reference) {
      return res.status(400).send({ error: "required reference" });
    }
    const payment = await PaymentModel.findOne({
      user: user_id,
      reference,
    }).lean();
    return res.status(200).send({
      data: payment,
      message: "Payment fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

// const initialisePayment = async () => {
//   try {
//     const form = {
//       amount: 12000000,
//       email: "foster.ogwudu@yahoo.com",
//       currency: "NGN",
//       reference: "89290610605",
//       callback_url: "http://localhost:3000",
//       full_name: "Arinze Uzeto",
//     };
//     initializePayment(form, (error, body) => {
//       if (error) {
//         reject(error.message);
//       }
//       const response = JSON.parse(body);
//       console.log("response", response);

//       return response;
//     });
//   } catch (error) {
//     error.source = "Start Payement Service";
//     return reject(error);
//   }
// };
// initialisePayment().then(response => {
//     console.log("response", response)
// }).catch(error => {
//     console.log("error", error)
// })
const payShop = async (req, res) => {
  try {
    const { productOrder_id, paidAt, reference } = req.body;
    if (!productOrder_id) {
      return res.status(400).send({ error: "required productOrder_id" });
    }
    if (!paidAt) {
      return res.status(400).send({ error: "required paidAt" });
    }
    if (!reference) {
      return res.status(400).send({ error: "required reference" });
    }
    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (!authUser.isAdmin && !authUser.superAdmin) {
      return res.status(400).send({
        error: "You are not authorized to make payment to shop for this order",
      });
    }
    const productOrder = await ProductOrderModel.findOne({
      _id: productOrder_id,
    }).lean();
    if (!productOrder) {
      return res.status(404).send({ error: "Product Order not found" });
    }
    const shop_id = productOrder.shop.toString();
    const authShop = await ShopModel.findOne({ _id: shop_id }).lean();
    if (!authShop) {
      return res.status(404).send({ error: "Shop not found" });
    }
    if (!authShop) {
      return res.status(404).send({ error: "Shop not found" });
    }
    const status = productOrder.status.value;
    if (status !== "order delivered") {
      return res.status(400).send({ error: "Order not delivered" });
    }

    const shopRevenue = productOrder.shopRevenue;
    if (shopRevenue.status === "paid") {
      return res.status(400).send({ error: "Shop revenue already paid" });
    }
    shopRevenue.status = "paid";
    shopRevenue.paidAt = paidAt;
    shopRevenue.reference = reference;
    const updatedProductOrder = await ProductOrderModel.findOneAndUpdate(
      { _id: productOrder_id },
      { shopRevenue },
      { new: true }
    );
    if (!updatedProductOrder) {
      return res.status(400).send({ error: "unable to update shop revenue" });
    }

    if (shop_id) {
      const title = "Payment Received for Order";
      const itemNo = productOrder.itemNo;
      const body = `Payment received for item no ${itemNo} in the order - ${productOrder.orderId}`;
      const image = productOrder.images[0].link;
      const shopId = authShop?.shopId || "";
      const notificationData = {
        notificationType: "shopPayment",
        roleType: "vendor",
        shopId,
      };
      const notifyShopParam = {
        shop_id,
        title,
        body,
        image,
        data: notificationData,
      };
      const notify = await notifyShop(notifyShopParam);
    }
    return res.status(200).send({
      data: updatedProductOrder,
      message: "Shop revenue updated successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const revertPayShop = async (req, res) => {
  try {
    const { productOrder_id } = req.body;
    if (!productOrder_id) {
      return res.status(400).send({ error: "required productOrder_id" });
    }
    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (!authUser.isAdmin && !authUser.superAdmin) {
      return res.status(400).send({
        error:
          "You are not authorized to revert payment to shop for this order",
      });
    }
    const productOrder = await ProductOrderModel.findOne({
      _id: productOrder_id,
    }).lean();
    if (!productOrder) {
      return res.status(404).send({ error: "Product Order not found" });
    }

    const shopRevenue = productOrder.shopRevenue;
    if (shopRevenue.status === "pending") {
      return res.status(400).send({ error: "Shop revenue already pending" });
    }
    shopRevenue.status = "pending";
    shopRevenue.paidAt = null;
    shopRevenue.reference = null;
    const updatedProductOrder = await ProductOrderModel.findOneAndUpdate(
      { _id: productOrder_id },
      { shopRevenue },
      { new: true }
    );
    if (!updatedProductOrder) {
      return res.status(400).send({ error: "unable to update shop revenue" });
    }
    return res.status(200).send({
      data: updatedProductOrder,
      message: "Shop revenue updated successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

module.exports = {
  getReference,
  verifyPayment,
  getPayments,
  getPayment,
  getUserPayments,
  getUserPayment,
  payShop,
  revertPayShop,
  stripeWebhook,
};
