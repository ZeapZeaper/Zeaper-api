const { cache } = require("../helpers/cache");
const { getAuthUser } = require("../middleware/firebaseUserAuth");
const ExchangeRateModel = require("../models/exchangeRate");

const getExchangeRate = async (req, res) => {
  try {
    const exchangeRate = await ExchangeRateModel.find().populate(
      "logs.user",
      "firstName lastName imageUrl"
    );

    return res.status(200).send({ data: exchangeRate });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const updateExchangeRate = async (req, res) => {
  try {
    const { rate, currency } = req.body;
    if (!rate) {
      return res.status(400).send({ error: "required rate" });
    }
    if (!currency) {
      return res.status(400).send({ error: "required currency" });
    }

    const authUser = req?.cachedUser || (await getAuthUser(req));

    const exchangeRate = await ExchangeRateModel.findOne({
      currency,
    });
    if (!exchangeRate) {
      res.status(400).send({ error: "Exchange Rate not found" });
    }
    exchangeRate.rate = rate;
    exchangeRate.logs.push({
      currency,
      user: authUser._id,
      value: rate,
      date: new Date(),
    });
    await exchangeRate.save();

    // Update the cache
    cache.set("exchangeRates", await ExchangeRateModel.find().lean(), 0);
    console.log("✅ Exchange rates updated in cache after modification");
    return res.status(200).send({ data: exchangeRate });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

module.exports = {
  getExchangeRate,
  updateExchangeRate,
};
