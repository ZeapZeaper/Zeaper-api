require("dotenv").config();
const fs = require("fs");
const UserModel = require("../models/user");
const ShopModel = require("../models/shop");
const crypto = require("crypto");
const CryptoJS = require("crypto-js");
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
  const bytes  = CryptoJS.AES.decrypt(text, ENCRYPTION_KEY);
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
}
module.exports = {
  deleteLocalFile,
  numberWithCommas,
  onlyUnique,
  cryptoEncrypt,
  cryptoDecrypt,
  verifyUserId,
  verifyShopId,
  checkForDuplicates,
  lowerFirstChar
};
