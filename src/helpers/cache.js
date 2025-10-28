
// cache.js
const NodeCache = require("node-cache");
const ExchangeRateModel = require("../models/exchangeRate");
const cache = new NodeCache({ stdTTL: 3600 }); // default TTL = 1 hour
const userCache = new NodeCache({ stdTTL: 60 * 30 }); // default TTL = 30 minutes
const tokenCache = new NodeCache({ stdTTL: 600 * 6 }); // default TTL = 1 hour

const preloadExchangeRates = async () => {
  try {
    const rates = await ExchangeRateModel.find().lean();
    cache.set("exchangeRates", rates, 0); // no expiration
    console.log("✅ Exchange rates preloaded into cache");
  } catch (err) {
    console.error("❌ Failed to preload exchange rates:", err.message);
  }
};

module.exports = { cache, userCache, tokenCache, preloadExchangeRates };
