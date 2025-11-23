const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");
const { sendEmail } = require("../../helpers/emailer");

const NotificationSchema = new mongoose.Schema({
  pushToken: [{ type: String, required: false }],
  pushTokenDate: { type: Date, required: false },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: false,
  },
  isAdminPanel: { type: Boolean, required: true, default: false },
  notifications: [
    {
      title: { type: String, required: true },
      body: { type: String, required: true },
      data: { type: Object, required: false },
      image: { type: String, required: false },
      seen: { type: Boolean, required: true, default: false },
      createdAt: { type: Date, required: true, default: Date.now },
    },
  ],
});

NotificationSchema.plugin(timestamp);

const NotificationModel = mongoose.model(
  "Notifications",
  NotificationSchema,
  "Notifications"
);

module.exports = NotificationModel;
