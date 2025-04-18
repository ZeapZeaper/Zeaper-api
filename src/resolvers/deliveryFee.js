const { getAuthUser } = require("../middleware/firebaseUserAuth");
const DeliveryFeeModel = require("../models/deliveryFee");

const updateDeliveryFee = async (req, res) => {
  try {
    const { fee, country } = req.body;
    if (!fee && fee !== 0) {
      return res.status(400).send({ error: "required fee" });
    }
    if (!country) {
      return res.status(400).send({ error: "required country" });
    }

    const currency = "NGN";
    const authUser = await getAuthUser(req);

    const deliveryFee = await DeliveryFeeModel.findOne({
      country,
    });
    
    deliveryFee.fee = fee;
    deliveryFee.logs.push({
      currency,
      user: authUser._id,
      value: fee,
      date: new Date(),
    });
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
    return res.status(200).send({ data: deliveryFees });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

module.exports = {
  updateDeliveryFee,
  getDeliveryFees,
};
