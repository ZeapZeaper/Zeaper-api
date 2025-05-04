require("dotenv").config();
const fs = require("fs");
const root = require("../../root");
const UserModel = require("../models/user");
const ShopModel = require("../models/shop");
const path = require("path");
const crypto = require("crypto");
const CryptoJS = require("crypto-js");
const ProductModel = require("../models/products");
const { error } = require("console");
const VoucherModel = require("../models/voucher");
const DeliveryFeeModel = require("../models/deliveryFee");
const ExchangeRateModel = require("../models/exchangeRate");
const BodyMeasurementGuideModel = require("../models/bodyMeasurementGuide");
const { shopVariables, userVariables, orderVariables } = require("./constants");
const algorithm = "aes-256-ctr";
const ENCRYPTION_KEY = process.env.ZEAPCRYPTOKEY;
//const ENCRYPTION_KEY = "emVhcCBmYXNoaW9uIGFwcCBpcyBvd25l==";
const IV_LENGTH = 16;

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
const calculateDeliveryFee = (fee, quantity) => {
  if (fee === 0) {
    return 0;
  }
  if (quantity === 0) {
    return 0;
  }
  if (quantity === 1) {
    return fee;
  }
  // increase by 30% for each additional item
  const additionalItems = quantity - 1;
  const additionalFee = fee * 0.3 * additionalItems;
  const totalFee = fee + additionalFee;
  return totalFee;
};

const calculateTotalBasketPrice = async (basket, country) => {
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
  const voucherAmount = voucher ? voucher.amount : 0;
  const currentDeliveryFee = await DeliveryFeeModel.findOne({
    country: country,
  }).lean();
  const quantity = basketItems.reduce((acc, item) => {
    return acc + item.quantity;
  }, 0);
  const deliveryFee = calculateDeliveryFee(
    currentDeliveryFee?.fee || 0,
    quantity
  );
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
    itemsTotal -= voucherAmount;
    if (itemsTotal < 0) {
      itemsTotal = 0;
    }
    const total = itemsTotal + deliveryFee;
    resolve({
      itemsTotal,
      total,
      items,
      appliedVoucherAmount: voucherAmount,
      deliveryFee,

      ...(voucher && { totalWithoutVoucher: itemsTotal + voucherAmount }),
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
const currencyCoversion = async (amount, currency) => {
  if (amount === 0) {
    return 0;
  }
  if (currency === "NGN") {
    return amount;
  }
  const currencyRates = await ExchangeRateModel.find();
  let rate;
  if (currency === "USD") {
    rate = currencyRates.find((rate) => rate.currency === "USD").rate;
    const convertedAmount = amount * rate;
    return convertedAmount;
  }
  if (currency === "GBP") {
    rate = currencyRates.find((rate) => rate.currency === "GBP").rate;
    const convertedAmount = amount * rate;
    return convertedAmount;
  }
  return amount;
};
const covertToNaira = async (amount, currency) => {
  if (amount === 0) {
    return 0;
  }
  if (currency === "NGN") {
    return amount;
  }
  const currencyRates = await ExchangeRateModel.find();
  let rate;
  if (currency === "USD") {
    rate = currencyRates.find((rate) => rate.currency === "USD").rate;
    const convertedAmount = amount * rate;
    return convertedAmount;
  }
  if (currency === "GBP") {
    rate = currencyRates.find((rate) => rate.currency === "GBP").rate;
    const convertedAmount = amount * rate;
    return convertedAmount;
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
  if ((currency = "NGN")) {
    return amount;
  }
  amount * rate;
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
  currencyCoversion,
  covertToNaira,
  addWeekDays,
  getBodyMeasurementEnumsFromGuide,
  getDaysDifference,
  calcRate,
  replaceUserVariablesinTemplate,
  replaceShopVariablesinTemplate,
  replaceOrderVariablesinTemplate,
};
