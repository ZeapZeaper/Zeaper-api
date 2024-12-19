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
const numberWithCommas = (x) => {
  return x?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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

const calculateTotalBasketPrice = async (basket) => {
  const basketItems = basket.basketItems;
  if (basketItems.length === 0) {
    return { total: 0, items: [], appliedVoucherAmount: 0 };
  }
  const voucher = await VoucherModel.findOne({
    _id: basket.voucher,
    user: basket.user,
    isUsed: true,
  }).lean();
  const voucherAmount = voucher ? voucher.amount : 0;
  return new Promise(async (resolve) => {
    let total = 0;
    let items = [];
    for (let i = 0; i < basketItems.length; i++) {
      const item = basketItems[i];
      const product = await ProductModel.findOne({ _id: item.product }).lean();
      const variation = product.variations.find((v) => v.sku === item.sku);

      const totalPrice =
        (variation?.discount || variation.price) * item.quantity;
      total += totalPrice;
      items.push({
        item: basketItems[i],
        quantity: item.quantity,
        totalPrice,
      });
    }
    total -= voucherAmount;
    if (total < 0) {
      total = 0;
    }
    resolve({
      total,
      items,
      appliedVoucherAmount: voucherAmount,

      ...(voucher && { totalWithoutVoucher: total + voucherAmount }),
    });
  });
};

const validateBodyMeasurements = (bodyMeasurements) => {
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

    if (
      !measurements ||
      !Array.isArray(measurements) ||
      measurements.length === 0
    ) {
      error = `One or more measurements in ${measurement.name} has no measurement object`;
      return { error };
    }
    measurement.measurements.forEach((m) => {
      const { field, value } = m;

      if (!field || field === "" || field === undefined) {
        error = `One or more measurements in ${name} has no field`;
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
  validateProductAvailability,
  calculateTotalBasketPrice,
  validateBodyMeasurements,
  codeGenerator,
};
