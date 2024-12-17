const { getAuthUser } = require("../middleware/firebaseUserAuth");
const PointModel = require("../models/points");
const VoucherModel = require("../models/voucher");
const { generateVoucher } = require("./voucher");

const getAuthUserPoint = async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    const point = await PointModel.findOne({
      user: authUser._id,
    });

    return res.status(200).send({
      data: point,
      message: "Point fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const getUserPoint = async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).send({ error: "required user_id" });
    }
    const point = await PointModel.findOne({
      user: user_id,
    });
    return res.status(200).send({
      data: point,
      message: "Point fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const addPointAfterSales = async (user_id, pointToAdd) => {
  try {
    const point = await PointModel.findOne({
      user: user_id,
    });

    if (!point) {
      const newPoint = new PointModel({
        user: user_id,
        availablePoints: pointToAdd,
        redeemedPoints: 0,
        totalPoints: pointToAdd,
      });
      await newPoint.save();
      return { data: newPoint };
    }
    point.availablePoints += pointToAdd;
    point.totalPoints += pointToAdd;
    await point.save();
    return { data: point };
  } catch (error) {
    return { error };
  }
};
const convertPointToVoucher = async (req, res) => {
  try {
    const { user_id, pointToConvert } = req.body;

    if (!pointToConvert) {
      return res.status(400).send({ error: "required pointToConvert" });
    }
    // check if pointToConvert is a number and greater than 1000
    if (isNaN(pointToConvert) || pointToConvert < 1000) {
      return res.status(400).send({
        error: "pointToConvert must be a number and greater than 1000",
      });
    }
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    if (
      authUser._id !== user_id &&
      !authUser.isAdmin &&
      !authUser.isSuperAdmin
    ) {
      return res
        .status(400)
        .send({ error: "You are not authorized to perform this operation" });
    }
    const user = user_id || authUser._id;

    const point = await PointModel.findOne({
      user,
    });
    if (!point) {
      return res.status(400).send({ error: "User point not found" });
    }
    if (point.availablePoints < pointToConvert) {
      return res.status(400).send({ error: "Insufficient point" });
    }
    const source = "point conversion";
    const newVoucher = await generateVoucher(pointToConvert, user, source);

    if (newVoucher.error) {
      return res.status(400).send({ error: newVoucher.error });
    }
    if (!newVoucher?._id) {
      return res.status(400).send({ error: "Voucher not created" });
    }

    point.availablePoints -= pointToConvert;
    point.redeemedPoints += pointToConvert;
    await point.save();
    return res.status(200).send({
      data: newVoucher,
      message: "Point converted to voucher successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

module.exports = {
  getAuthUserPoint,
  getUserPoint,
  addPointAfterSales,
  convertPointToVoucher,
};
