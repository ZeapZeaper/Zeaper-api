const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");
const {
  productTypeEnums,
  promoStatusEnums,
} = require("../../helpers/constants");

const PromoSchema = new mongoose.Schema({
  promoId: { type: String, required: true, unique: true },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  description: { type: String, required: true },
  title: { type: String, required: true },
  imageUrl: {
    link: { type: String, required: false },
    name: { type: String, required: false },
    type: { type: String, required: false, default: "image" },
  },
  status: {
    type: String,
    enum: promoStatusEnums,
    required: true,
    default: "draft",
  },
  subTitle: { type: String, required: true },
  discount: {
    type: {
      type: String,
      enum: ["range", "fixed"],
      required: true,
    },
    fixedPercentage: { type: Number, required: false },
    rangePercentage: {
      min: { type: Number, required: false },
      max: { type: Number, required: false },
    },
  },
  productIds: [{ type: String, required: false }],
  permittedProductTypes: {
    type: [
      {
        type: String,
        enum: productTypeEnums,
      },
    ],
    required: false,
    default: [...productTypeEnums],
  },
});
PromoSchema.plugin(timestamp);

const PromoModel = mongoose.model("Promos", PromoSchema, "Promos");

module.exports = PromoModel;
