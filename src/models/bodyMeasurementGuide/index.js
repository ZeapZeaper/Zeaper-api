const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const BodyMeasurementGuideSchema = new mongoose.Schema({
  name: { type: String, required: true },
  fields: [
    {
      field: { type: String, required: true },
      imageUrl: {
        link: { type: String, required: false },
        name: { type: String, required: false },
      },
      description: { type: String, required: false },
      gender: [{ type: String, required: false }],
    },
  ],
});

BodyMeasurementGuideSchema.plugin(timestamp);

const BodyMeasurementGuideModel = mongoose.model(
  "BodyMeasurementGuides",
  BodyMeasurementGuideSchema,
  "BodyMeasurementGuides"
);

module.exports = BodyMeasurementGuideModel;
