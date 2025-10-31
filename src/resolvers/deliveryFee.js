const { type } = require("../config/firebaseServiceAcc");
const { getAuthUser } = require("../middleware/firebaseUserAuth");
const DeliveryFeeModel = require("../models/deliveryFee");

const updateDeliveryFee = async (req, res) => {
  try {
    const { fee,  id, freeDeliveryThreshold } = req.body;
    if (!fee && fee !== 0) {
      return res.status(400).send({ error: "required fee" });
    }
   
    if (!id) {
      return res.status(400).send({ error: "required id" });
    }
    if (freeDeliveryThreshold) {
      if (freeDeliveryThreshold.enabled && !freeDeliveryThreshold.amount) {
        return res.status(400).send({
          error: "required freeDeliveryThreshold amount since its enabled",
        });
      }
      if (freeDeliveryThreshold.enabled && freeDeliveryThreshold.amount < 0) {
        return res.status(400).send({
          error: "freeDeliveryThreshold amount cannot be less than 0",
        });
      }
    }

    const currency = "NGN";
    const authUser = req?.cachedUser || (await getAuthUser(req));

    const deliveryFee = await DeliveryFeeModel.findById(id);
    if (!deliveryFee) {
      return res.status(404).send({ error: "Delivery fee not found" });
    }

    deliveryFee.fee = fee;
    if (freeDeliveryThreshold) {
      deliveryFee.freeDeliveryThreshold = freeDeliveryThreshold;
      if (!freeDeliveryThreshold.enabled) {
        deliveryFee.freeDeliveryThreshold.amount = 0;
      }
    }
    let log = {};
    if (freeDeliveryThreshold) {
      log = {
        type: "free_delivery_threshold_update",
        freeDeliveryThreshold: {
          enabled: freeDeliveryThreshold.enabled,
          amount: freeDeliveryThreshold.amount || 0,
        },
        currency,
        user: authUser._id,
        date: new Date(),
      };
    } else {
      log = {
        type: "delivery_fee_update",
        value: fee,
        currency,
        user: authUser._id,
        date: new Date(),
      };
    }
    deliveryFee.logs.push(log);
    await deliveryFee.save();
    return res.status(200).send({ data: deliveryFee });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const getDeliveryFees = async (req, res) => {
  try {
    const deliveryFees = await DeliveryFeeModel.find({}).populate(
      "logs.user",
      "firstName lastName imageUrl"
    );

    return res.status(200).send({
      data: deliveryFees.sort((a, b) => a.country.localeCompare(b.country)),
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

module.exports = {
  updateDeliveryFee,
  getDeliveryFees,
};
