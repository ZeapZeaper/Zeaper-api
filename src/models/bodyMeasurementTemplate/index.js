const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const BodyMeasurementTemplateSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  templateName: { type: String, required: true },
  gender: { type: String, required: true },
  measurements: [
    {
      field: { type: String, required: true },
      value: { type: Number, required: true },
      unit: { type: String, value: "inch", required: true },
    },
  ],
});

BodyMeasurementTemplateSchema.plugin(timestamp);

const BodyMeasurementTemplateModel = mongoose.model(
  "BodyMeasurementTemplates",
  BodyMeasurementTemplateSchema,
  "BodyMeasurementTemplates"
);

module.exports = BodyMeasurementTemplateModel;
