"use strict";

const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");
const {
  genderEnums,
  ageGroupEnums,
  ageRangeEnums,
  productTypeEnums,
  sleeveLengthEnums,
  fasteningEnums,
  occasionEnums,
  fitEnums,
  brandEnums,
  clothStyleEnums,
  designEnums,
  clothSizeEnums,
  mainEnums,
  shoeStyleEnums,
  heelHightEnums,
  heelTypeEnums,
  shoeSizeEnums,
  accessoryTypeEnums,
  accessoryStyleEnums,
  accessorySizeEnums,
  sizeStandardEnums,
} = require("../../helpers/constants");
const { size } = require("lodash");

const ProductSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  productType: { type: String, enum: productTypeEnums, required: true },
  disabled: { type: Boolean, required: false, default: false },
  shopId: { type: String, required: true },
  isBespoke: { type: Boolean, required: true, default: false },
  isReadyMade: { type: Boolean, required: true, default: false },
  title: { type: String, required: true },
  subTitle: { type: String, required: false },
  status: { type: String, required: true, default: "draft" },
  promo: {
    promoId: { type: String, required: false },
    discountPercentage: { type: Number, required: false },
    adminControlledDiscount: { type: Boolean, required: false, default: false },
  },
  autoPriceAdjustment: {
    isAdjustable: { type: Boolean, required: false, default: false },
    adjustmentPercentage: { type: Number, required: false, default: 0 },
  },
  currentStep: { type: Number, required: true, default: 1 },
  categories: {
    gender: [
      {
        type: String,
        enum: genderEnums,
      },
    ],
    age: {
      ageGroup: { type: String, enum: ageGroupEnums, required: false },
      ageRange: { type: String, enum: ageRangeEnums, required: false },
    },
    productGroup: { type: String, required: false },

    style: [
      {
        type: String,
        enum: [...clothStyleEnums, ...shoeStyleEnums, ...accessoryStyleEnums],
      },
    ],
    main: [
      {
        type: String,
        enum: mainEnums,
      },
    ],

    sleeveLength: { type: String, enum: sleeveLengthEnums, required: false },
    heelHeight: { type: String, enum: heelHightEnums, required: false },
    heelType: { type: String, enum: heelTypeEnums, required: false },
    accessoryType: { type: String, enum: accessoryTypeEnums, required: false },

    design: [
      {
        type: String,
        enum: designEnums,
      },
    ],
    fastening: [
      {
        type: String,
        enum: fasteningEnums,
      },
    ],
    occasion: [
      {
        type: String,
        enum: occasionEnums,
      },
    ],
    fit: [
      {
        type: String,
        enum: fitEnums,
      },
    ],
    brand: {
      type: String,
      enum: brandEnums,
      required: false,
      default: "Other",
    },
  },

  description: { type: String, required: true },
  sizes: [
    {
      type: String,
      enum: [...clothSizeEnums, ...shoeSizeEnums, ...accessorySizeEnums],
      required: true,
    },
  ],
  sizeStandard: {
    type: String,
    required: false,
    enum:[...sizeStandardEnums,"Custom"],
  },
  colors: [
    {
      value: { type: String, required: true },
      images: [
        {
          link: { type: String, required: true },
          name: { type: String, required: true },
          isDefault: { type: Boolean, required: false, default: false },
        },
      ],
    },
  ],

  variations: [
    {
      sku: { type: String, required: true },
      price: { type: Number, required: true },
      discount: { type: Number, required: false },
      colorValue: { type: String, required: true },
      size: { type: String, required: true },
      quantity: { type: Number, required: true },
      bespoke: {
        isBespoke: { type: Boolean, required: true, default: false },
        colorType: {
          type: String,
          required: false,
          enum: ["single", "multiple"],
        },
        availableColors: [
          {
            type: String,
            required: false,
          },
        ],
      },
    },
  ],
  bodyMeasurement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BodyMeasurement",
    required: false,
  },

  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shops", required: true },
  timeLine: [
    {
      date: { type: String, required: true },
      description: { type: String, required: true },
      actionBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
        required: true,
      },
    },
  ],
  rejectionReasons: [
    {
      type: String,
      required: true,
    },
  ],
});

ProductSchema.plugin(timestamp);
const ProductModel = mongoose.model("Product", ProductSchema);

module.exports = ProductModel;
