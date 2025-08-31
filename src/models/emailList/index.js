const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const EmailListSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    subscribedTo: {
      type: String,
      required: true,
      enum: ["newsletter", "waitlist"],
      default: "newsletter",
    },
    source: { type: String, required: true, default: "website" },
  }
);
EmailListSchema.plugin(timestamp);  

const EmailListModel = mongoose.model(
  "EmailList",
  EmailListSchema,
  "EmailList"
);

module.exports = EmailListModel;
