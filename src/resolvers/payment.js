const PaymentModel = require("../models/payment");
const BasketModel = require("../models/basket");
const { ENV } = require("./../config");
const {
  calculateTotalBasketPrice,
  codeGenerator,
} = require("../helpers/utils");
const request = require("request");
const { getAuthUser } = require("../middleware/firebaseUserAuth");
const DeliveryAddressModel = require("../models/deliveryAddresses");
const { createOrder } = require("./order");
const OrderModel = require("../models/order");
const { addPointAfterSales } = require("./point");

const secretKey =
  ENV === "dev"
    ? process.env.PAYSTACK_SECRET_TEST_KEY
    : process.env.PAYSTACK_SECRET_LIVE_KEY;
const environment = process.env.NODE_ENV;

function getRandomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const generateReference = async () => {
  let reference;
  let found = true;
  do {
    const randomVal = getRandomInt(10000000000, 99999999999);
    const code = codeGenerator(5);
    reference = `${randomVal}${code}`;
    const exist = await PaymentModel.findOne({ reference }).lean();

    if (exist) {
      found = true;
    } else {
      found = false;
    }
  } while (found);

  return reference.toString();
};

const getReference = async (req, res) => {
  try {
    const { basketId, deliveryAddress_id } = req.query;
    if (!basketId) {
      return res.status(400).send({ error: "required basketId" });
    }
    if (!deliveryAddress_id) {
      return res.status(400).send({ error: "required deliveryAddress_id" });
    }
    const authUser = await getAuthUser(req);
    const basket = await BasketModel.findOne({ basketId })
      .populate("user")
      .lean();
    if (!basket) {
      return res.status(404).send({ error: "Basket not found" });
    }
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
      !authUser.isSuperAdmin
    ) {
      return res.status(400).send({
        error: "You are not authorized to make payment for this basket",
      });
    }
    let payment = await PaymentModel.findOne({ basket: basket._id }).lean();
    const reference = payment?.reference || await generateReference();
  
    if (payment) {
      if (payment.status === "success") {
        return res.status(400).send({ error: "Payment already made" });
      }
      const addDeliveryAddress = await BasketModel.findOneAndUpdate(
        { basketId },
        { deliveryAddress: deliveryAddress_id },
        { new: true }
      );
      if (!addDeliveryAddress) {
        return res
          .status(400)
          .send({ error: "Delivery Address not added to basket" });
      }
      const updatePayment = await PaymentModel.findOneAndUpdate(
        { basketId },
        { reference },
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
          amount: payment.amount,
          fullName: payment.fullName,
          email: payment.email,
        },
        message: "Reference fetched successfully",
      });
    }

    const calculateTotal = await calculateTotalBasketPrice(basket);

    // convert amount to kobo or cent
    const amount = calculateTotal.total * 100;

    const user = basket.user;
    const fullName = user.firstName + " " + user.lastName;
    const email = user.email;

    payment = new PaymentModel({
      reference,
      user: user._id,
      fullName,
      email,
      basket: basket._id,
      status: "pending",
      amount,
    });

    await payment.save();
    return res.status(200).send({
      data: { reference, amount, fullName, email },
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
    console.log("error", error);
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
module.exports = {
  getReference,
  verifyPayment,
};
