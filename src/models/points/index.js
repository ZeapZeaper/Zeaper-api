const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");
const { type } = require("../../config/firebaseServiceAcc");

const PointSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  availablePoints: { type: Number, required: true },
  redeemedPoints: { type: Number, required: true },
  totalPoints: { type: Number, required: true },
  timeline: [
    {
      description: { type: String, required: true },
      points : { type: Number, required: true },
      type: { type: String, required: true , enum: ["add", "minus"]},
      createdAt: { type: Date, required: true },
    },
  ],
});

PointSchema.plugin(timestamp);

const PointModel = mongoose.model("Points", PointSchema, "Points");

module.exports = PointModel;
