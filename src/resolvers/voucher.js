const { codeGenerator } = require("../helpers/utils");
const { getAuthUser } = require("../middleware/firebaseUserAuth");
const BasketModel = require("../models/basket");
const VoucherModel = require("../models/voucher");

const generateVoucherCode = async () => {
  let valid = false;
  let voucherCode;
  do {
    voucherCode = codeGenerator();

    const exist = await VoucherModel.findOne({ code: voucherCode }).lean();
    console.log("exist", exist);
    if (!exist) {
      valid = true;
    }
  } while (!valid);
  return voucherCode;
};

const generateVoucher = async (amount, user, source) => {
  try {
    const voucherCode = await generateVoucherCode();

    // make expiryDate 30 days from now by 12:00am
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    expiryDate.setHours(0, 0, 0, 0);

    const voucher = new VoucherModel({
      code: voucherCode,
      amount,
      expiryDate,
      user,
      source,
    });
    await voucher.save();
    return voucher;
  } catch (error) {
    return { error: error.message };
  }
};
const getAuthUserActiveVouchers = async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    const vouchers = await VoucherModel.find({
      user: authUser._id,
      isUsed: false,
      expiryDate: { $gte: new Date() },
    });
    return res.status(200).send({
      data: vouchers,
      message: "Vouchers fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const getAuthUserInactiveVouchers = async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    const vouchers = await VoucherModel.find({
      user: authUser._id,
      $or: [{ isUsed: true }, { expiryDate: { $lt: new Date() } }],
    });
    return res.status(200).send({
      data: vouchers,
      message: "Vouchers fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const getVouchers = async (req, res) => {
  try {
    const vouchers = await VoucherModel.find();
    return res.status(200).send({
      data: vouchers,
      message: "Vouchers fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const getVoucher = async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send({ error: "required code" });
    }
    const voucher = await VoucherModel.findOne({
      code,
    });
    return res.status(200).send({
      data: voucher,
      message: "Voucher fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const getUserActiveVouchers = async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).send({ error: "required user_id" });
    }
    const vouchers = await VoucherModel.find({
      user: user_id,
      isUsed: false,
      expiryDate: { $gte: new Date() },
    });
    return res.status(200).send({
      data: vouchers,
      message: "Vouchers fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const getUserInactiveVouchers = async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).send({ error: "required user_id" });
    }
    const vouchers = await VoucherModel.find({
      user: user_id,
      $or: [{ isUsed: true }, { expiryDate: { $lt: new Date() } }],
    });
    return res.status(200).send({
      data: vouchers,
      message: "Vouchers fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const applyVoucher = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).send({ error: "required code" });
    }

    const user = await getAuthUser(req);
    if (!user) {
      return res.status(400).send({ error: "User not found" });
    }
    const voucher = await VoucherModel.findOne({
      code,
    });
    if (!voucher) {
      return res.status(400).send({ error: "Voucher not found" });
    }
    if (voucher.isUsed) {
      return res.status(400).send({ error: "Voucher already used" });
    }
    if (voucher.expiryDate < new Date()) {
      return res.status(400).send({ error: "Voucher expired" });
    }
    if (voucher.user.toString() !== user._id.toString()) {
      return res.status(400).send({ error: "Voucher not for this user" });
    }
    const basket = await BasketModel.findOne({
      user: user._id,
    });
    if (!basket) {
      return res.status(400).send({ error: "Basket not found" });
    }

    basket.voucher = voucher._id;
    await basket.save();

    voucher.isUsed = true;
    await voucher.save();
    return res.status(200).send({
      data: voucher,
      message: "Voucher used successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

module.exports = {
  generateVoucher,
  getAuthUserActiveVouchers,
  getAuthUserInactiveVouchers,
  getVouchers,
  getVoucher,
  getUserActiveVouchers,
  getUserInactiveVouchers,
  applyVoucher,
};
