const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const BodyMeasurementGuideFieldSchema = new mongoose.Schema({
  field: { type: String, required: true, unique: true },
});

BodyMeasurementGuideFieldSchema.plugin(timestamp);

const BodyMeasurementGuideFieldModel = mongoose.model(
  "BodyMeasurementGuideFields",
  BodyMeasurementGuideFieldSchema,
  "BodyMeasurementGuideFields"
);

module.exports = BodyMeasurementGuideFieldModel;
