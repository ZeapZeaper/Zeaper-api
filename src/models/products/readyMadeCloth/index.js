"use strict";

const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const ClothesSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  shopId: { type: String, required: true },
  title: { type: String, required: true },
  subTitle: { type: String, required: true },
  status: { type: String, required: true, default: "under review" },
  isReadyMade: { type: Boolean, required: true, default: true },
  categories: {
    gender: {
      type: String,
      enum: ["male", "female", "unisex"],
    },
    ageGroup: {
      type: String,
      enum: ["adult", "children", "infant"],
    },
    shirt: {
      type: String,
      enum: ["shirt", "polo", "hoodie", "sweatshirt"],
    },
    trouser: {
      type: String,
      enum: ["trouser", "short", "skirt"],
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
  },

  description: { type: String, required: true },
  sizes: [
    {
      sizeId: { type: String, required: true },
      value: { type: Number, required: true },
    },
  ],
  colors: [
    {
      colorId: { type: String, required: true },
      value: { type: String, required: true },
      images: [
        {
          link: { type: String, required: true },
          name: { type: String, required: true },
        },
      ],
    },
  ],
  variations: [
    {
      sku: { type: String, required: true },
      price: { type: Number, required: true },
      discount: { type: Number, required: false },
      colorId: { type: String, required: true },
      sizeId: { type: String, required: true },
      stock: { type: Number, required: true },
    },
  ],
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
  shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shops" },
});

ClothesSchema.plugin(timestamp);
const Clothes = mongoose.model("Clothes", ClothesSchema);

module.exports = Clothes;
