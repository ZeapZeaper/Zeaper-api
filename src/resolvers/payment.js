const PaymentModel = require("../models/payment");
const BasketModel = require("../models/basket");
const { ENV } = require("./../config");
const {
  calculateTotalBasketPrice,
  codeGenerator,
  currencyCoversion,
  replaceUserVariablesinTemplate,
  replaceOrderVariablesinTemplate,
} = require("../helpers/utils");
const request = require("request");
const { getAuthUser } = require("../middleware/firebaseUserAuth");
const DeliveryAddressModel = require("../models/deliveryAddresses");
const { createOrder } = require("./order");
const OrderModel = require("../models/order");
const { addPointAfterSales } = require("./point");
const ProductOrderModel = require("../models/productOrder");
const { notifyShop } = require("./notification");
const { sendEmail } = require("../helpers/emailer");
const EmailTemplateModel = require("../models/emailTemplate");
const UserModel = require("../models/user");
const { at } = require("lodash");

const secretKey =
  ENV === "dev"
    ? process.env.PAYSTACK_SECRET_TEST_KEY
    : process.env.PAYSTACK_SECRET_LIVE_KEY;
const environment = process.env.NODE_ENV;

const generateReference = (param) => {
  const { firstName, lastName, basketId } = param;
  const firstChar = firstName.charAt(0).toUpperCase();
  const lastChar = lastName.charAt(0).toUpperCase();
  const today = new Date();
  const ref = `${firstChar}${lastChar}-${basketId}-${today.getTime()}`;
  return ref;
};

const getReference = async (req, res) => {
  try {
    const { basketId, deliveryAddress_id } = req.query;
    let paymentStatus = "pending";
    let orderId = null;
    if (!deliveryAddress_id) {
      return res.status(400).send({ error: "required deliveryAddress_id" });
    }

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }

    const basketQuery = {
      ...(basketId && { basketId }),
      ...(!basketId && { user: authUser._id }),
    };

    const basket = await BasketModel.findOne(basketQuery)
      .populate("user")
      .lean();
    if (!basket) {
      return res.status(404).send({ error: "Basket not found" });
    }
    const user = basket.user;
    if (
      basketId &&
      !authUser.isAdmin &&
      !authUser.superAdmin &&
      user._id !== authUser._id
    ) {
      return res.status(400).send({
        error:
          "You are not authorized to make payment for this basket. Ensure you are not sending basketId as query parameter as you are not an admin",
      });
    }

    const currency = authUser.prefferedCurrency || "NGN";

    const deliveryAddress = await DeliveryAddressModel.findOne({
      _id: deliveryAddress_id,
      user: authUser._id,
    }).lean();
    if (!deliveryAddress) {
      return res.status(404).send({ error: "Delivery Address not found" });
    }

    if (
      authUser._id.toString() !== basket.user._id.toString() &&
      !authUser.isAdmin &&
      !authUser.superAdmin
    ) {
      return res.status(400).send({
        error: "You are not authorized to make payment for this basket",
      });
    }

    const payment = await PaymentModel.findOne({
      basket: basket._id.toString(),
    }).lean();
    if (payment) {
      verifyPaystack(payment?.reference, async (error, body) => {
        const response = JSON.parse(body);
        if (response.status === true) {
          const {
            amount,
            status,
            paidAt,
            channel,
            currency,
            transaction_date,
            log,
            fees,
            gateway_response,
            authorization,
          } = response.data;
          const { card_type, bank, country_code } = authorization;

          if (status === "success") {
            paymentStatus = "success";
            const updatedPayment = await PaymentModel.findOneAndUpdate(
              { reference },
              {
                amount,
                status,
                paidAt,
                channel,
                currency,
                transactionDate: transaction_date,
                log,
                fees,
                cardType: card_type,
                bank,
                countryCode: country_code,
                gatewayResponse: gateway_response,
              },
              { new: true }
            );

            // 1000 naira = 10 points
            // round down to the nearest 1000
            const pointToAdd = Math.floor(amount / 1000) * 10;
            const existingOrder = await OrderModel.findOne({
              payment: updatedPayment._id,
            }).lean();
            orderId = existingOrder.orderId;
            if (!existingOrder) {
              const order = await createOrder({
                payment: updatedPayment,
                user: updatedPayment.user,
              });
              if (order.error) {
                return res.status(400).send({ error: order.error });
              }
              orderId = order.orderId;
              const addPoints = await addPointAfterSales(
                updatedPayment.user,
                pointToAdd
              );
            }

            return res.status(200).send({
              message: "Payment already made",
              data: {
                reference: payment.reference,
                amount,
                currency,
                fullName,
                email,
                paymentStatus,
                orderId,
              },
            });
          }
        }
      });
    }
    const calculateTotal = await calculateTotalBasketPrice(basket);

    // convert amount to kobo or cent
    const amountDue = calculateTotal.total * 100;
    const itemsTotalDue = calculateTotal.itemsTotal * 100;
    const deliveryFeeDue = calculateTotal.deliveryFee * 100;
    const appliedVoucherAmountDue = calculateTotal.appliedVoucherAmount * 100;
    const totalDue = calculateTotal.total * 100;
    console.log("calculateTotal", calculateTotal);

    const amount = await currencyCoversion(amountDue, currency);
    const itemsTotal = await currencyCoversion(itemsTotalDue, currency);
    const deliveryFee = await currencyCoversion(deliveryFeeDue, currency);
    const appliedVoucherAmount = await currencyCoversion(
      appliedVoucherAmountDue,
      currency
    );
    const total = await currencyCoversion(totalDue, currency);

    const fullName = user.firstName + " " + user.lastName;
    const email = user.email;
    const reference = generateReference({
      firstName: user.firstName,
      lastName: user.lastName,
      basketId: basket.basketId,
    });

    if (payment) {
      if (payment.status === "success") {
        paymentStatus = "success";
      }
      const addDeliveryAddress = await BasketModel.findOneAndUpdate(
        { basketId: basket.basketId },
        { deliveryAddress: deliveryAddress_id },
        { new: true }
      );
      if (!addDeliveryAddress) {
        return res
          .status(400)
          .send({ error: "Delivery Address not added to basket" });
      }
      const updatePayment = await PaymentModel.findOneAndUpdate(
        { basket: basket._id.toString() },
        {
          currency,
          amount,
          fullName,
          email,
          itemsTotal,
          deliveryFee,
          total,
          appliedVoucherAmount,
          reference,
        },
        { new: true }
      );
      if (!updatePayment) {
        return res
          .status(400)
          .send({ error: "unable to update payment reference" });
      }

      return res.status(200).send({
        data: {
          reference,
          currency,
          amount,
          fullName,
          email,
          paymentStatus,
          orderId,
        },
        message: "Reference fetched successfully",
      });
    }

    const newPayment = new PaymentModel({
      reference,
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
    });

    await newPayment.save();
    return res.status(200).send({
      data: {
        reference,
        amount,
        currency,
        fullName,
        email,
        paymentStatus,
        orderId,
      },
      message: "Reference fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const verifyPaystack = (ref, mycallback) => {
  const options = {
    url:
      "https://api.paystack.co/transaction/verify/" + encodeURIComponent(ref),
    headers: {
      authorization: `Bearer ${secretKey}`,
      "content-type": "application/json",
      "cache-control": "no-cache",
    },
  };
  const callback = (error, response, body) => {
    return mycallback(error, body);
  };
  request(options, callback);
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

const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.body;
    if (!reference) {
      return res.status(400).send({ error: "required reference" });
    }

    const payment = await PaymentModel.findOne({ reference }).lean();
    if (!payment) {
      return res.status(404).send({
        error:
          "Payment not found. Please ensure you have the correct reference",
      });
    }
    // if (payment.status === "success") {
    //   return res
    //     .status(200)
    //     .send({ message: "Payment already verified", data: { payment } });
    // }

    verifyPaystack(reference, async (error, body) => {
      if (error) {
        console.log("error 1", error);
        reject(error.message);
      }
      const response = JSON.parse(body);

      if (response.status !== true) {
        return res.status(400).send({
          error: "Payment not successful",
        });
      }

      const {
        amount,
        status,
        paidAt,
        channel,
        currency,
        transaction_date,
        log,
        fees,
        gateway_response,
        authorization,
      } = response.data;
      const { card_type, bank, country_code } = authorization;

      if (status === "success") {
        const updatedPayment = await PaymentModel.findOneAndUpdate(
          { reference },
          {
            amount,
            status,
            paidAt,
            channel,
            currency,
            transactionDate: transaction_date,
            log,
            fees,
            cardType: card_type,
            bank,
            countryCode: country_code,
            gatewayResponse: gateway_response,
          },
          { new: true }
        );
        if (!updatedPayment) {
          return res.status(400).send({
            error:
              "Payment successful but unable to update payment. Please contact support",
          });
        }
        // 1000 naira = 10 points
        // round down to the nearest 1000
        const pointToAdd = Math.floor(amount / 1000) * 10;
        const existingOrder = await OrderModel.findOne({
          payment: updatedPayment._id,
        }).lean();
        if (existingOrder) {
          return res.status(200).send({
            message: "Payment verified successfully",
            data: {
              payment: updatedPayment,
              order: existingOrder,
              addedPoints: pointToAdd,
            },
          });
        }

        const order = await createOrder({
          payment: updatedPayment,
          user: updatedPayment.user,
        });
        if (order.error) {
          return res.status(400).send({ error: order.error });
        }
        const addPoints = await addPointAfterSales(
          updatedPayment.user,
          pointToAdd
        );
        order.orderPoints = pointToAdd;
        const orderEmailTemplate = await EmailTemplateModel.findOne({
          name: "successful-order",
        }).lean();
        const user = await UserModel.findOne({
          _id: updatedPayment.user,
        }).lean();
        const email = user.email;
        const formattedOrderTemplateBody = replaceOrderVariablesinTemplate(
          replaceUserVariablesinTemplate(orderEmailTemplate?.body, user),
          order
        );

        const formattedOrderTemplateSubject = replaceOrderVariablesinTemplate(
          replaceUserVariablesinTemplate(orderEmailTemplate?.subject, user),
          order
        );

        const param = {
          from: "admin@zeaper.com",
          to: [email],
          subject: formattedOrderTemplateSubject || "Welcome",
          body: formattedOrderTemplateBody || "Welcome to Zeap",
          attach: true,
          order_id: order._id,
        };
        const orderMail = await sendEmail(param);

        return res.status(200).send({
          message: "Payment verified successfully",
          data: { payment: updatedPayment, order, addedPoints: pointToAdd },
        });
      }
      return res.status(400).send({
        error: "Payment not successful",
      });
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const getPayments = async (req, res) => {
  try {
    const payments = await PaymentModel.find().populate("user").lean();
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
    const authUser = await getAuthUser(req);
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
    const shop_id = productOrder.shop.toString();
    if (shop_id) {
      const title = "Payment Received for Order";
      const itemNo = productOrder.itemNo;
      const body = `Payment received for item no ${itemNo} in the order - ${productOrder.orderId}`;
      const image = productOrder.images[0].link;
      const notifyShopParam = { shop_id, title, body, image };
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
    const authUser = await getAuthUser(req);
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
};
