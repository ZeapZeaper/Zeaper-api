"use strict";

const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");
const {
  genderEnums,
  ageGroupEnums,
  topEnums,
  bottomEnums,
} = require("../../../helpers/constants");
const { type } = require("../../../config/firebaseServiceAcc");

const ReadyMadeClothesSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  disabled: { type: Boolean, required: false, default: false },
  shopId: { type: String, required: true },
  title: { type: String, required: true },
  subTitle: { type: String, required: true },
  status: { type: String, required: true, default: "under review" },
  isReadyMadeCloth: { type: Boolean, required: true, default: true },
  categories: {
    gender: {
      type: String,
      enum: genderEnums,
    },
    ageGroup: {
      type: String,
      enum: ageGroupEnums,
    },
    top: {
      type: String,
      enum: topEnums,
    },
    bottom: {
      type: String,
      enum: bottomEnums,
    },
    isJeans: { type: Boolean, required: false },
    isSuit: { type: Boolean, required: false },
    isTraditional: { type: Boolean, required: false },
    isCorporate: { type: Boolean, required: false },
    isSport: { type: Boolean, required: false },
    isCasual: { type: Boolean, required: false },
    isVest: { type: Boolean, required: false },
    isJacket: { type: Boolean, required: false },
    isBlazer: { type: Boolean, required: false },
    isGym: { type: Boolean, required: false },
    isSwim: { type: Boolean, required: false },
    isUnderwear: { type: Boolean, required: false },
    isNightwear: { type: Boolean, required: false },
    isGown: { type: Boolean, required: false },
    isTracksuit: { type: Boolean, required: false },
    isJoggers: { type: Boolean, required: false },
    isKnitwear: { type: Boolean, required: false },
    isPlussize: { type: Boolean, required: false },
    isTwoPiece: { type: Boolean, required: false },
    isWhiteWedding: { type: Boolean, required: false },
    isTraditionalWedding: { type: Boolean, required: false },
    isAsoebi: { type: Boolean, required: false },
    isGroomsMen: { type: Boolean, required: false },
    isBridalTrain: { type: Boolean, required: false },
    isBridalShower: { type: Boolean, required: false },
    isBirthDay: { type: Boolean, required: false },
    isBurial: { type: Boolean, required: false },
    brand: { type: String, required: false },
  },

  description: { type: String, required: true },
  sizes: [
    {
      type: String,
      required: true,
    },
  ],
  colors: [
    {
      value: { type: String, required: true },
      imageNames: [{ type: String, required: true }],
    },
  ],
  images: [
    {
      link: { type: String, required: true },
      name: { type: String, required: true },
      originalname: { type: String, required: true },
    },
  ],
  variations: [
    {
      sku: { type: String, required: true },
      price: { type: Number, required: true },
      discount: { type: Number, required: false },
      colorValue: { type: String, required: true },
      size: { type: String, required: true },
      stock: { type: Number, required: true },
    },
  ],
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shops", required: true },
});

ReadyMadeClothesSchema.plugin(timestamp);
const ReadyMadeClothes = mongoose.model(
  "ReadyMadeClothes",
  ReadyMadeClothesSchema
);

module.exports = ReadyMadeClothes;
