const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const OnboardingDocumentSchema = new mongoose.Schema({
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shops",
    required: true,
  },
  shopId: {
    type: String,
    required: true,
  },
  slug: {
    type: String,
    required: true,
  },
  imageUrl: {
    name: { type: String, required: true },
    link: { type: String, required: true },
    filetype: { type: String, required: true, enum: ["image", "pdf"] },
  },
});

OnboardingDocumentSchema.plugin(timestamp);

const OnboardingDocumentModel = mongoose.model(
  "OnboardingDocuments",
  OnboardingDocumentSchema,
  "OnboardingDocuments"
);

module.exports = OnboardingDocumentModel;
