const {
  codeGenerator,
  currencyConversion,
  getDaysDifference,
  calcRate,
} = require("../helpers/utils");
const { getAuthUser } = require("../middleware/firebaseUserAuth");
const BasketModel = require("../models/basket");
const NotificationModel = require("../models/notification");
const UserModel = require("../models/user");
const VoucherModel = require("../models/voucher");
const { notifyIndividualUser } = require("./notification");

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

const generateVoucher = async (amount, user, source, expireOn) => {
  try {
    const voucherCode = await generateVoucherCode();

    // make expiryDate 30 days from now by 12:00am if not specified
    const expiryDate = expireOn ? new Date(expireOn) : new Date();
    if (!expireOn) {
      expiryDate.setDate(expiryDate.getDate() + 30);
    }
    expiryDate.setHours(0, 0, 0, 0);
    const currency = "NGN";

    const voucher = new VoucherModel({
      code: voucherCode,
      amount,
      expiryDate,
      user,
      source,
      currency,
    });
    await voucher.save();
    return voucher;
  } catch (error) {
    return { error: error.message };
  }
};
const issueVoucher = async (req, res) => {
  try {
    const { amount, user_id, expiryDate } = req.body;
    if (!amount) {
      return res.status(400).send({ error: "required amount" });
    }
    if (!user_id) {
      return res.status(400).send({ error: "required user_id" });
    }
    if (!expiryDate) {
      return res.status(400).send({ error: "required expiryDate" });
    }
    if (new Date(expiryDate) <= new Date()) {
      return res
        .status(400)
        .send({ error: "expiryDate must be greater than today" });
    }
    const authUser = await getAuthUser(req);
    if (!authUser.superAdmin) {
      return res.status(400).send({
        error: "You dont have the required permission. Contact Super Admin",
      });
    }

    const requestedUser = await UserModel.findById(user_id);

    if (!requestedUser) {
      return res.status(400).send({ error: "User not found" });
    }

    const user = requestedUser._id;

    const source = "admin";
    const voucher = await generateVoucher(amount, user, source, expiryDate);
    if (voucher.error) {
      return res.status(400).send({ error: voucher.error });
    }
    const currency = requestedUser.prefferedCurrency || "NGN";
    let rate = null;
    if (currency !== "NGN") {
      // ✅ Try cached rates first
      let currencyRates = cache.get("exchangeRates");

      // If cache empty, fetch from DB once and set cache
      if (!currencyRates) {
        currencyRates = await ExchangeRateModel.find().lean();
        cache.set("exchangeRates", currencyRates);
      }
      rate = currencyRates.find((rate) => rate.currency === currency).rate;
    }

    const code = voucher.code;
    const title = "Voucher Issued";
    const body = `A voucher of ${currency} ${calcRate(
      rate,
      currency,
      amount
    )} has been issued to you. Use code ${code} to redeem before it expires in ${getDaysDifference(
      new Date(voucher.expiryDate)
    )} days`;
    const image = "";
    const notificationData = {
      notificationType: "voucher",
      roleType: "buyer",
      code,
    };
    const notifyuser = await notifyIndividualUser({
      user_id: requestedUser._id,
      title,
      body,
      image,
      data: notificationData,
    });

    return res.status(200).send({
      data: voucher,
      message: "Voucher issued successfully",
    });
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
    const currency = req.query.currency || authUser?.prefferedCurrency || "NGN";

    const data = [];
    const promises = vouchers.map(async (voucher) => {
      const amountInPreferredCurrency = await currencyConversion(
        voucher.amount,
        currency
      );

      voucher.amount = amountInPreferredCurrency;
      voucher.currency = currency;

      data.push(voucher);
      return voucher;
    });
    await Promise.all(promises);
    return res.status(200).send({
      data,
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
    const currency = req.query.currency || authUser?.prefferedCurrency || "NGN";
    const data = [];
    const promises = vouchers.map(async (voucher) => {
      const amountInPreferredCurrency = await currencyConversion(
        voucher.amount,
        currency
      );
      voucher.amount = amountInPreferredCurrency;
      voucher.currency = currency;
      data.push(voucher);
      return voucher;
    });
    await Promise.all(promises);
    return res.status(200).send({
      data,
      message: "Vouchers fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const getVouchers = async (req, res) => {
  try {
    const vouchers = await VoucherModel.find(req.query);
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
    })
      .populate("user")
      .lean();
    if (!voucher) {
      return res.status(400).send({ error: "Voucher not found" });
    }
    const currency =
      req.query.currency || voucher?.user?.prefferedCurrency || "NGN";
    const amountInPreferredCurrency = await currencyConversion(
      voucher.amount,
      currency
    );
    voucher.amount = amountInPreferredCurrency;
    voucher.currency = currency;
    return res.status(200).send({
      data: voucher,
      message: "Voucher fetched successfully",
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
      return res.status(400).send({
        error:
          "Voucher with this code not found. Please check the code and try again.",
      });
    }
    if (voucher.isUsed) {
      return res.status(400).send({ error: "Voucher has already been used" });
    }
    if (voucher.expiryDate < new Date()) {
      return res.status(400).send({ error: "Voucher has expired" });
    }
    if (voucher.user.toString() !== user._id.toString()) {
      return res
        .status(400)
        .send({ error: "This voucher does not belong to you" });
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
const removeVoucher = async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(400).send({ error: "User not found" });
    }
    const basket = await BasketModel.findOne({
      user: user._id,
    });
    if (!basket) {
      return res.status(400).send({ error: "Basket not found" });
    }
    const basketVoucher = basket.voucher;
    basket.voucher = null;
    await basket.save();
    if (basketVoucher) {
      const voucher = await VoucherModel.findById(basketVoucher);
      if (voucher) {
        voucher.isUsed = false;
        await voucher.save();
      }
    }
    return res.status(200).send({
      message: "Voucher removed successfully",
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
  applyVoucher,
  removeVoucher,
  issueVoucher,
};
