require("dotenv").config();
const fs = require("fs");
const root = require("../../root");
const UserModel = require("../models/user");
const ShopModel = require("../models/shop");
const path = require("path");
const crypto = require("crypto");
const CryptoJS = require("crypto-js");
const ProductModel = require("../models/products");
const VoucherModel = require("../models/voucher");
const DeliveryFeeModel = require("../models/deliveryFee");
const ExchangeRateModel = require("../models/exchangeRate");
const BodyMeasurementGuideModel = require("../models/bodyMeasurementGuide");
const {
  shopVariables,
  userVariables,
  orderVariables,
  productOrderVariables,
} = require("./constants");
const algorithm = "aes-256-ctr";
const ENCRYPTION_KEY = process.env.ZEAPCRYPTOKEY;
//const ENCRYPTION_KEY = "emVhcCBmYXNoaW9uIGFwcCBpcyBvd25l==";
const IV_LENGTH = 16;
const { exec } = require("child_process");
const UAParser = require("ua-parser-js");
const { cache } = require("./cache");
const { ENV } = require("../config");
const redis = require("./redis");

const deleteLocalFile = async (path) => {
  return new Promise((resolve) => {
    fs.unlink(path, (error) => {
      error && console.log("WARNING:: Delete local file", error);
      resolve();
    });
  });
};

const deleLocalImages = async (files) => {
  for (let i = 0; i < files?.length; i++) {
    const file = files[i];
    const source = path.join(root + "/uploads/" + file.filename);

    const deleteSourceFile = await deleteLocalFile(source);
  }
};
const deleteLocalImagesByFileName = async (filename) => {
  const source = path.join(root + "/uploads/" + filename);
  const deleteSourceFile = await deleteLocalFile(source);
};
const numberWithCommas = (x) => {
  return x?.toString().replaceAll(/\B(?=(\d{3})+(?!\d))/g, ",");
};

function onlyUnique(value, index, array) {
  return array.indexOf(value) === index;
}
const cryptoEncrypt = (text) => {
  let iv = crypto.randomBytes(IV_LENGTH);

  let cipher = crypto.createCipheriv(
    algorithm,
    Buffer.concat([Buffer.from(ENCRYPTION_KEY), Buffer.alloc(32)], 32),
    iv
  );

  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const result = iv.toString("hex") + ":" + encrypted.toString("hex");

  return result;
};
const cryptoDecrypt = (text) => {
  const bytes = CryptoJS.AES.decrypt(text, ENCRYPTION_KEY);
  const originalText = bytes.toString(CryptoJS.enc.Utf8);
  return originalText;
};
// const cryptoDecrypt = (text) => {
//   console.log("text", text);
//   let textParts = text.split(":");
//   let iv = Buffer.from(textParts.shift(), "hex");
//   let encryptedText = Buffer.from(textParts.join(":"), "hex");
//   console.log("iv", iv);
//   let decipher = crypto.createDecipheriv(
//     algorithm,
//     Buffer.concat([Buffer.from(ENCRYPTION_KEY), Buffer.alloc(32)], 32),
//     iv
//   );
//   console.log("decipher", decipher);
//   let decrypted = decipher.update(encryptedText);
//   decrypted = Buffer.concat([decrypted, decipher.final()]);

//   return decrypted.toString();
// };
const verifyUserId = async (userId) => {
  const user = await UserModel.findOne({ userId });
  if (!user) {
    return false;
  }
  return user;
};
const verifyShopId = async (shopId) => {
  const shop = await ShopModel.findOne({ shopId });
  if (!shop) {
    return false;
  }
  return shop;
};
const checkForDuplicates = (array) => {
  return array.length !== new Set(array).size;
};
const lowerFirstChar = (str) => {
  return str.charAt(0).toLowerCase() + str.slice(1);
};
const validateProductAvailability = async (product, quantity, sku) => {
  const { variations } = product;
  const bespokeVariation = variations.find(
    (v) => v.sku === sku && v.bespoke.isBespoke
  );
  if (bespokeVariation) {
    return { success: true };
  }
  const variation = variations.find((v) => v.sku === sku);
  if (!variation) {
    return { error: "Product variation not found. ensure sku is correct" };
  }
  if (variation.quantity === 0) {
    return { error: `Product with sku ${sku} is out of stock` };
  }
  if (variation.quantity < quantity) {
    return {
      error: `Product with sku ${sku} has only ${variation.quantity} left`,
    };
  }
  return { success: true };
};
const calcLocalDeliveryFee = (fee, quantity) => {
  if (fee === 0) {
    return 0;
  }
  if (quantity === 0) {
    return 0;
  }
  if (quantity === 1) {
    return fee;
  }
  // increase by 50% for each additional item
  const additionalItems = quantity - 1;
  const additionalFee = fee * 0.5 * additionalItems;
  const totalFee = fee + additionalFee;
  return totalFee;
};
const calcInternationalDeliveryFee = (fee, quantity) => {
  if (fee === 0) {
    return 0;
  }
  if (quantity === 0) {
    return 0;
  }
  if (quantity === 1) {
    return fee;
  }
  // increase by 70% for each additional item
  const additionalItems = quantity - 1;
  const additionalFee = fee * 0.7 * additionalItems;
  const totalFee = fee + additionalFee;
  return totalFee;
};
const calculateDeliveryFee = async (country, method, quantity, itemsTotal) => {
  const currentDeliveryFee = await DeliveryFeeModel.findOne({
    country,
    method,
  }).lean();
  const fee = currentDeliveryFee?.fee || 0;

  if (fee === 0) {
    return 0;
  }
  if (quantity === 0) {
    return 0;
  }
  if (quantity === 1) {
    return fee;
  }
  const freeDeliveryThreshold = currentDeliveryFee?.freeDeliveryThreshold
    ?.enabled
    ? currentDeliveryFee.freeDeliveryThreshold.amount
    : null;
  if (freeDeliveryThreshold && itemsTotal >= freeDeliveryThreshold) {
    return 0;
  }
  let totalFee = 0;
  if (country === "NG") {
    totalFee = calcLocalDeliveryFee(fee, quantity);
  } else {
    totalFee = calcInternationalDeliveryFee(fee, quantity);
  }

  return totalFee;
};

const calculateTotalBasketPrice = async (basket, country, method) => {
  const basketItems = basket.basketItems;
  if (basketItems.length === 0) {
    return {
      total: 0,
      itemsTotal: 0,
      items: [],
      appliedVoucherAmount: 0,
      totalWithoutVoucher: 0,
      deliveryFee: 0,
    };
  }
  const voucher = await VoucherModel.findOne({
    _id: basket.voucher,
    user: basket.user,
    isUsed: true,
  }).lean();
  const voucherAmount = voucher ? Number(voucher.amount) : 0;

  const quantity = basketItems.reduce((acc, item) => {
    return acc + item.quantity;
  }, 0);

  return new Promise(async (resolve) => {
    let itemsTotal = 0;
    let items = [];
    for (let i = 0; i < basketItems.length; i++) {
      const item = basketItems[i];
      const product = await ProductModel.findOne({ _id: item.product }).lean();
      const variation = product.variations.find((v) => v.sku === item.sku);
      const totalPrice =
        (variation?.discount || variation.price) * item.quantity;

      itemsTotal += totalPrice;
      items.push({
        item: basketItems[i],
        quantity: item.quantity,
        actualAmount: totalPrice,
        discount: variation.discount
          ? variation.discount * item.quantity
          : null,
        originalAmount: variation?.price * item.quantity,
      });
    }

    if (itemsTotal < 0) {
      itemsTotal = 0;
    }
    const deliveryFee = await calculateDeliveryFee(
      country,
      method,
      quantity,
      itemsTotal
    );

    const total = itemsTotal + deliveryFee - voucherAmount;

    resolve({
      itemsTotal: itemsTotal.toFixed(2),
      total: total.toFixed(2),
      items,
      appliedVoucherAmount: voucherAmount,
      deliveryFee: deliveryFee.toFixed(2),

      ...(voucher && { totalWithoutVoucher: itemsTotal + deliveryFee }),
    });
  });
};

const validateBodyMeasurements = (bodyMeasurements, bodyMeasurementEnums) => {
  let error;
  if (
    !bodyMeasurements ||
    !Array.isArray(bodyMeasurements) ||
    bodyMeasurements.length === 0
  ) {
    error = "Please provide a valid array of measurements";
    return { error };
  }

  bodyMeasurements.forEach((measurement) => {
    const { name, measurements } = measurement;
    if (!name || name === "" || name === undefined) {
      error = "One or more body measurements has no name";
      return { error };
    }
    const validItem = bodyMeasurementEnums.find(
      (m) =>
        m.name.toLowerCase().replaceAll(/\s/g, "") ===
        name.toLowerCase().replaceAll(/\s/g, "")
    );

    if (!validItem) {
      error = `One or more body measurements has an invalid name ${name}. Remember names are case sensitive. Valid names are ${bodyMeasurementEnums
        .map((m) => m.name)
        .join(", ")}`;
      return { error };
    }

    if (
      !measurements ||
      !Array.isArray(measurements) ||
      measurements.length === 0
    ) {
      error = `One or more measurements in ${measurement.name} has no measurement object`;
      return { error };
    }
    const validItemFields = validItem.fields;
    measurement.measurements.forEach((m) => {
      const { field, value } = m;

      if (!field || field === "" || field === undefined) {
        error = `One or more measurements in ${name} has no field`;
        return { error };
      }
      const validField = validItemFields.find(
        (f) =>
          f.toLowerCase().replaceAll(/\s/g, "") ===
          field.toLowerCase().replaceAll(/\s/g, "")
      );
      if (!validField) {
        error = `One or more measurements in ${name} has an invalid field ${field}. Valid fields are ${validItemFields.join(
          ", "
        )}`;
        return { error };
      }
      if (!value || value === "" || value === undefined) {
        error = `One or more measurements in ${name} with field ${m.field} has no value`;
        return { error };
      }
    });
  });

  if (error) {
    return { error };
  }
  return { success: true };
};
const codeGenerator = (length) => {
  let code = "";
  const condeLength = length || 10;
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz";
  for (let i = 0; i < condeLength; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
};

const currencyConversion = async (amount, currency) => {
  if (amount === null || amount === undefined || amount === "") return null;
  if (amount === 0) return 0;
  if (currency === "NGN") return amount;

  // ✅ Try cached rates first
  let currencyRates = cache.get("exchangeRates");

  // If cache empty, fetch from DB once and set cache
  if (!currencyRates) {
    currencyRates = await ExchangeRateModel.find().lean();
    cache.set("exchangeRates", currencyRates);
    console.log("💾 Exchange rates loaded into cache");
  }

  // find rate from cached list
  const rateObj = currencyRates.find((r) => r.currency === currency);
  const rate = rateObj ? rateObj.rate : 1;

  const convertedAmount = amount * rate;
  return convertedAmount.toFixed(2);
};
const currencyConversionFromCache = (amount, currency) => {
  if (amount === null || amount === undefined || amount === "") return null;
  if (amount === 0) return 0;
  if (currency === "NGN") return amount;

  // ✅ Get cached exchange rates (already preloaded at startup)
  const currencyRates = cache.get("exchangeRates");
  if (!currencyRates) {
    console.warn(
      "⚠️ Exchange rates cache is empty — returning unconverted amount."
    );
    return amount;
  }

  const rateObj = currencyRates.find((r) => r.currency === currency);
  const rate = rateObj ? rateObj.rate : 1;

  const convertedAmount = amount * rate;
  return Number(convertedAmount.toFixed(2));
};
const covertToNaira = async (amount, currency) => {
  if (amount === null || amount === undefined || amount === "") {
    return null;
  }
  if (amount === 0) {
    return 0;
  }
  if (currency === "NGN") {
    return amount;
  }
  let currencyRates = cache.get("exchangeRates");
  if (!currencyRates) {
    currencyRates = await ExchangeRateModel.find().lean();
    cache.set("exchangeRates", currencyRates);
    console.log("💾 Exchange rates loaded into cache");
  }
  let rate;
  if (currency === "USD") {
    rate = currencyRates.find((rate) => rate.currency === "USD").rate;
    const convertedAmount = amount * rate;
    return convertedAmount.toFixed(2);
  }
  if (currency === "GBP") {
    rate = currencyRates.find((rate) => rate.currency === "GBP").rate;
    const convertedAmount = amount * rate;
    return convertedAmount.toFixed(2);
  }

  return amount;
};

const addWeekDays = (startDate, count) =>
  Array.from({ length: count }).reduce((date) => {
    date = new Date(date.setDate(date.getDate() + 1));
    if (date.getDay() % 6 === 0)
      date = new Date(date.setDate(date.getDate() + (date.getDay() / 6 + 1)));
    return date;
  }, startDate);
// {
//   // update amount of all productOrders in database
//   const promises = productOrders.map(async (productOrder) => {
//     const amount = [
//       {
//         currency: "NGN",
//         value: productOrder.amount,
//       },
//     ];
//     const updatedOrder = await ProductOrderModel.findOneAndUpdate(
//       { _id: productOrder._id },
//       { amount },
//       { new: true }
//     );
//     return updatedOrder;
//   });
//   await Promise.all(promises);
// }

const getBodyMeasurementEnumsFromGuide = async () => {
  const bodyMeasurementGuide = await BodyMeasurementGuideModel.find().lean();

  const maleBodyMeasurementGuide = bodyMeasurementGuide.filter(
    (guide) => guide.gender === "male"
  );
  const maleBodyMeasurementEums = maleBodyMeasurementGuide.map((guide) => {
    const name = guide.name;
    const fields = guide.fields.map((field) => field.field);

    return {
      name,
      fields,
    };
  });
  const femaleBodyMeasurementGuide = bodyMeasurementGuide.filter(
    (guide) => guide.gender === "female"
  );
  const femaleBodyMeasurementEums = femaleBodyMeasurementGuide.map((guide) => {
    const name = guide.name;
    const fields = guide.fields.map((field) => field.field);

    return {
      name,
      fields,
    };
  });
  const data = {
    cloth: [
      {
        gender: "male",
        value: [...maleBodyMeasurementEums]
          .sort((a, b) => a.name.localeCompare(b.name))
          .filter((m) => m.name !== "shoe"),
      },
      {
        gender: "female",
        value: [...femaleBodyMeasurementEums]
          .sort((a, b) => a.name.localeCompare(b.name))
          .filter((m) => m.name !== "shoe"),
      },
    ],
    shoe: [
      {
        gender: "male",
        value: [...maleBodyMeasurementEums]
          .sort((a, b) => a.name.localeCompare(b.name))
          .filter((m) => m.name === "shoe"),
      },
      {
        gender: "female",
        value: [...femaleBodyMeasurementEums]
          .sort((a, b) => a.name.localeCompare(b.name))
          .filter((m) => m.name === "shoe"),
      },
    ],
  };
  return data;
};
const getDaysDifference = (date) => {
  const today = new Date();
  const diffTime = Math.abs(today - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};
const calcRate = (rate, currency, amount) => {
  if (amount === null || amount === undefined || amount === "") {
    return null;
  }
  if (amount === 0) {
    return 0;
  }
  if (currency === "NGN") {
    return amount;
  }
  const convertedAmount = amount * rate;
  return convertedAmount.toFixed(2);
};

const replaceUserVariablesinTemplate = (template, user) => {
  const variables = userVariables;
  const replacedBracket = template.replaceAll("[", "").replaceAll("]", "");

  let replacedTemplate = replacedBracket;

  // loop through all variables. if variable is in replacedBracket, replaceAll with user data
  variables.forEach((variable) => {
    if (replacedBracket.includes(variable)) {
      replacedTemplate = replacedTemplate.replaceAll(
        variable,
        user[variable] || ""
      );
    }
  });
  return replacedTemplate;
};
const replaceShopVariablesinTemplate = (template, shop) => {
  const variables = shopVariables;
  const replacedBracket = template.replaceAll("[", "").replaceAll("]", "");

  let replacedTemplate = replacedBracket;

  // loop through all variables. if variable is in replacedBracket, replaceAll with user data
  variables.forEach((variable) => {
    if (replacedBracket.includes(variable)) {
      replacedTemplate = replacedTemplate.replaceAll(
        variable,
        shop[variable] || ""
      );
    }
  });
  return replacedTemplate;
};
const replaceOrderVariablesinTemplate = (template, order) => {
  const variables = orderVariables;
  const replacedBracket = template.replaceAll("[", "").replaceAll("]", "");
  let replacedTemplate = replacedBracket;

  // loop through all variables. if variable is in replacedBracket, replaceAll with user data
  variables.forEach((variable) => {
    if (replacedBracket.includes(variable)) {
      replacedTemplate = replacedTemplate.replaceAll(
        variable,
        order[variable] || ""
      );
    }
  });

  return replacedTemplate;
};
const replaceProductOrderVariablesinTemplate = (template, productOrder) => {
  const variables = productOrderVariables;
  const replacedBracket = template.replaceAll("[", "").replaceAll("]", "");
  let replacedTemplate = replacedBracket;
  productOrder.expectedVendorCompletionDate =
    productOrder.expectedVendorCompletionDate?.max || "";
  productOrder.expectedDeliveryDate =
    productOrder?.expectedDeliveryDate?.max || "";
  productOrder.productTitle = productOrder?.productTitle || "";
  productOrder.productQuantity = productOrder?.quantity || "";
  // loop through all variables. if variable is in replacedBracket, replaceAll with user data
  variables.forEach((variable) => {
    if (replacedBracket.includes(variable)) {
      replacedTemplate = replacedTemplate.replaceAll(
        variable,
        productOrder[variable] || ""
      );
    }
  });

  return replacedTemplate;
};
const allowedLocations = [
  {
    currency: "USD",
    label: "United States Dollar",
    symbol: "$",
    countryCode: "US",
    timezone: "America/New_York",
    default: false,
  },
  {
    currency: "NGN",
    label: "Nigerian Naira",
    symbol: "₦",
    countryCode: "NG",
    timezone: "Africa/Lagos",
    default: true,
  },

  {
    currency: "GBP",
    label: "British Pound Sterling",
    symbol: "£",
    countryCode: "GB",
    timezone: "Europe/London",
    default: false,
  },
];
const getServerIp = async () => {
  return new Promise((resolve, reject) => {
    exec("curl ip-adresim.app", (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        reject(error);
      }
      const ip = stdout.trim();

      resolve(ip);
    });
  });
};
const getExpectedVendorCompletionDate = (productType) => {
  const bespokes = ["bespokeCloth", "bespokeShoe"];
  const isBespoke = bespokes.includes(productType);
  let min;
  let max;
  if (isBespoke) {
    min = 10;
    max = 15;
  } else {
    min = 1;
    max = 2;
  }
  return { min, max, productType };
};

const getExpectedStandardDeliveryDate = (productType, country) => {
  const bespokes = ["bespokeCloth", "bespokeShoe"];
  const isBespoke = bespokes.includes(productType);
  const method = "standard";

  let min;
  let max;
  if (country.toLowerCase() === "nigeria") {
    if (isBespoke) {
      min = 15;
      max = 20;
    } else {
      min = 3;
      max = 5;
    }
  } else {
    if (isBespoke) {
      min = 25;
      max = 30;
    } else {
      min = 10;
      max = 15;
    }
  }
  return { min, max, method, country };
  // const minDate = addWeekDays(today, min);
  // const maxDate = addWeekDays(today, max);
  // return {
  //   minDate: minDate.toISOString().split("T")[0],
  //   maxDate: maxDate.toISOString().split("T")[0],
  // };
};
const getExpectedExpressDeliveryDate = (productType, country) => {
  const bespokes = ["bespokeCloth", "bespokeShoe"];
  const isBespoke = bespokes.includes(productType);
  const method = "express";
  const today = new Date();
  let min;
  let max;
  if (country.toLowerCase() === "nigeria") {
    if (isBespoke) {
      min = 15;
      max = 20;
    } else {
      min = 3;
      max = 5;
    }
  } else {
    if (isBespoke) {
      min = 15;
      max = 20;
    } else {
      min = 5;
      max = 10;
    }
  }
  return { min, max, method, country };
};
const calcShopRevenueValue = ({
  productType,
  originalAmountDue,
  amountDue,
  adminControlledDiscount = false,
}) => {
  const amount = adminControlledDiscount ? originalAmountDue : amountDue;
  const bespokes = ["bespokeCloth", "bespokeShoe"];
  // 75% for bespoke
  // 80% for ready-to-wear
  const isBespoke = bespokes.includes(productType);
  let revenueValue = amount;
  // I temporarily disabled this logic as per request due to launching incentives for early vendors
  // if (isBespoke) {
  //   revenueValue = amount * 0.75;
  // } else {
  //   revenueValue = amount * 0.8;
  // }
  return revenueValue.toFixed(2);
};
const detectDeviceType = (req) => {
  const ua = req.headers["user-agent"] || "";

  const parser = new UAParser(ua);
  const device = parser.getDevice();
  const deviceType = device.type || "desktop";
  return deviceType;
};
function convertToCdnUrl(url) {
  try {
    const match = url.match(/\/b\/([^/]+)\/o\/([^?]+)/);
    if (!match) return null;

    const bucketName = match[1];
    const encodedPath = match[2]; // e.g. "%2FbodyMeasurementGuide%2FIMG_0063.jpg"
    return `https://storage.googleapis.com/${bucketName}/${encodedPath}`;
  } catch (err) {
    console.error("❌ Failed to convert:", url, err);
    return null;
  }
}

/**
 * Generates a consistent Redis cache key.
 * - Includes NODE_ENV prefix to isolate dev/prod.
 * - Hashes complex data objects for safe, short keys.
 *
 * @param {string} prefix - The logical key prefix (e.g., 'mostPopular:base')
 * @param {object} data - Object representing query parameters, IDs, etc.
 * @returns {string} - A safe, unique Redis key
 */
const makeCacheKey = (prefix, data) => {
  const hash = crypto
    .createHash("sha1")
    .update(JSON.stringify(data))
    .digest("hex");
  return `${ENV}:${prefix}:${hash}`;
};
const deleteRedisKeysByPrefix = async (prefix) => {
  try {
    let cursor = "0";
    let totalDeleted = 0;

    do {
      // Ensure cursor is a string
      const { cursor: nextCursor, keys } = await redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);

      if (keys && keys.length > 0) {
        const pipeline = redis.multi();
        for (const key of keys) {
          pipeline.del(key);
        }

        const results = await pipeline.exec();
        totalDeleted += results?.length || 0;
      }

      cursor = nextCursor;
    } while (cursor !== "0");

    console.log(`✅ Deleted ${totalDeleted} Redis keys with prefix: ${prefix}`);
  } catch (err) {
    console.error(`❌ Failed to delete keys with prefix ${prefix}:`, err);
  }
};


module.exports = {
  deleteLocalFile,
  numberWithCommas,
  onlyUnique,
  cryptoEncrypt,
  cryptoDecrypt,
  verifyUserId,
  verifyShopId,
  checkForDuplicates,
  lowerFirstChar,
  deleLocalImages,
  deleteLocalImagesByFileName,
  validateProductAvailability,
  calculateTotalBasketPrice,
  validateBodyMeasurements,
  codeGenerator,
  currencyConversion,
  currencyConversionFromCache,
  covertToNaira,
  addWeekDays,
  getBodyMeasurementEnumsFromGuide,
  getDaysDifference,
  calcRate,
  replaceUserVariablesinTemplate,
  replaceShopVariablesinTemplate,
  replaceOrderVariablesinTemplate,
  replaceProductOrderVariablesinTemplate,
  getServerIp,
  allowedLocations,
  getExpectedExpressDeliveryDate,
  getExpectedStandardDeliveryDate,
  getExpectedVendorCompletionDate,
  detectDeviceType,
  calcShopRevenueValue,
  convertToCdnUrl,
  makeCacheKey,
  deleteRedisKeysByPrefix,
};
