"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");
const { currencyEnums } = require("../../helpers/constants");

const SocialSchema = new mongoose.Schema({
  twitter: String,
  facebook: String,
  instagram: String,
  tiktok: String,
});

const UserSchema = new mongoose.Schema({
  userId: { type: String, required: true, sparse: true, unique: true },
  uid: { type: String, required: true, sparse: true, unique: true },
  shopId: { type: String, required: false },
  shopEnabled: { type: Boolean, required: false, default: false },
  lastSignIn: {
    date: { type: String, required: false },
    browser: { type: String, required: false },
    os: { type: String, required: false },
    device: { type: String, required: false },
    isDesktop: { type: Boolean, required: false },
    isMobile: { type: Boolean, required: false },
  },
  isGuest: { type: Boolean, required: false, default: false },
  acceptMarketing: { type: Boolean, required: false, default: false },
  role: { type: String, required: false },
  signInCount: { type: Number, required: false, default: 0 },
  firstName: { type: String, required: false },
  lastName: { type: String, required: false },
  gender: { type: String, required: false },
  phoneNumber: { type: String, required: false },
  salutation: { type: String, required: false },
  disabled: { type: Boolean, default: false },
  address: { type: String, required: false },
  isAdmin: { type: Boolean, required: true, default: false },
  isBlogAuthor: { type: Boolean, required: true, default: false },
  superAdmin: { type: Boolean, required: false, default: false },
  email: { type: String, required: false },
  creationTime: { type: String, required: false },
  createdBy: { type: String, required: false, default: "self" },
  imageUrl: {
    link: { type: String, required: false },
    name: { type: String, required: false },
  },
  social: SocialSchema,
  emailVerified: { type: Boolean, default: false },
  phoneNumberVerified: { type: Boolean, required: true, default: false },
  dateOfBirth: { type: String, required: false },
  country: { type: String, required: false },
  region: { type: String, required: false },
  postCode: { type: String, required: false },
  isVendor: { type: Boolean, required: false, default: false },
  points: { type: Number, required: false, default: 0 },
  weight: {
    unit: { type: String, required: false },
    value: { type: Number, required: false },
  },

  height: {
    unit: { type: String, required: false },
    value: { type: Number, required: false },
  },
  shoeSize: {
    country: { type: String, required: false },
    value: { type: Number, required: false },
  },
  bestOutfit: { type: String, required: false },
  bestColor: { type: String, required: false },
  prefferedCurrency: {
    type: String,
    required: false,
    enum: currencyEnums,
    default: "NGN",
  },
  source: { type: String, required: false },
});

UserSchema.plugin(timestamp);

const UserModel = mongoose.model("Users", UserSchema, "Users");

module.exports = UserModel;
