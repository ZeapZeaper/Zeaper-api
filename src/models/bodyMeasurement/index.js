const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");
const { type } = require("../../config/firebaseServiceAcc");

const BodyMeasurementSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  measurements: [
    {
      name: { type: String, required: true },
      fields: [{ type: String, required: true }],
    },
  ],
});

BodyMeasurementSchema.plugin(timestamp);

const BodyMeasurementModel = mongoose.model(
  "BodyMeasurement",
  BodyMeasurementSchema,
  "BodyMeasurement"
);

module.exports = BodyMeasurementModel;
