const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const RecentViewsSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  products: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
  ],
});
RecentViewsSchema.plugin(timestamp);
const RecentViewsModel = mongoose.model(
  "RecentViews",
  RecentViewsSchema,
  "RecentViews"
);
module.exports = RecentViewsModel;
