const { getAuthUser } = require("../middleware/firebaseUserAuth");
const DeliveryFeeModel = require("../models/deliveryFee");

const updateDeliveryFee = async (req, res) => {
  try {
    const { fee } = req.body;
    if (!fee) {
      return res.status(400).send({ error: "required fee" });
    }

    const currency = "NGN";
    const authUser = await getAuthUser(req);

    const defalutDeliveryFee = await DeliveryFeeModel.findOne({
      default: true,
    });
    if (!defalutDeliveryFee) {
      const deliveryFeeObj = {
        fee,
        default: true,
        currency,
        logs: [
          {
            currency,
            user: authUser._id,
            value: fee,
            date: new Date(),
          },
        ],
      };
      const deliveryFee = new DeliveryFeeModel(deliveryFeeObj);
      await deliveryFee.save();
      return res.status(200).send({ data: deliveryFee });
    }
    defalutDeliveryFee.fee = fee;
    defalutDeliveryFee.logs.push({
      currency,
      user: authUser._id,
      value: fee,
      date: new Date(),
    });
    await defalutDeliveryFee.save();
    return res.status(200).send({ data: defalutDeliveryFee });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const getDeliveryFee = async (req, res) => {
  try {
    const deliveryFee = await DeliveryFeeModel.findOne({
      default: true,
    }).populate("logs.user", "firstName lastName imageUrl");
    return res.status(200).send({ data: deliveryFee });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

module.exports = {
  updateDeliveryFee,
  getDeliveryFee,
};
