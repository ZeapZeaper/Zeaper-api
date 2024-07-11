"use strict";

const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");
const {
  genderEnums,
  ageGroupEnums,
  shoeTypeEnums,
} = require("../../../helpers/constants");

const ReadyMadeShoesSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  disabled: { type: Boolean, required: false, default: false },
  shopId: { type: String, required: true },
  title: { type: String, required: true },
  subTitle: { type: String, required: true },
  status: { type: String, required: true, default: "under review" },
  isReadyMadeShoe: { type: Boolean, value: true },
  categories: {
    gender: {
      type: String,
      enum: genderEnums,
    },
    ageGroup: {
      type: String,
      enum: ageGroupEnums,
    },
    shoeType: {
      type: String,
      enum: shoeTypeEnums,
    },
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

ReadyMadeShoesSchema.plugin(timestamp);
const ReadyMadeShoes = mongoose.model("ReadyMadeShoes", ReadyMadeShoesSchema);

module.exports = ReadyMadeShoes;
