"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const BusinessSocialSchema = new mongoose.Schema({
  twitter: String,
  facebook: String,
  instagram: String,
  website: String,
  linkedin: String,
});
const BankDetailSchema = new mongoose.Schema({
  bankName: { type: String, required: false },
  accountName: { type: String, required: false },
  accountNumber: { type: String, required: false },
});

const ShopSchema = new mongoose.Schema({
  shopId: { type: String, required: false },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  userId: { type: String, required: true },
  shopName: { type: String, required: true },
  businessName: { type: String, required: false },
  address: { type: String, required: false },
  phoneNumber: { type: String, required: false },
  region: { type: String, required: false },
  postCode: { type: String, required: false },
  country: { type: String, required: false },
  isTailor: { type: Boolean, required: false, default: false },
  isShoeMaker: { type: Boolean, required: false, default: false },
  disabled: { type: Boolean, required: false, default: false },
  sellerType: {
    type: String,
    enum: ["individual", "registered business"],
  },
  businessSocial: BusinessSocialSchema,
  currency: {
    type: {
      name: { type: String, required: true },
      symbol: { type: String, required: true },
    },
    required: false,
    default: {
      name: "Naira",
      symbol: "₦",
    },
  },
  bankDetails: BankDetailSchema,
});

ShopSchema.plugin(timestamp);

const ShopModel = mongoose.model("Shops", ShopSchema, "Shops");

module.exports = ShopModel;
