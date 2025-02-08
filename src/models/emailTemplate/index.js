const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const EmailTemplateSchema = new mongoose.Schema({
  body: { type: String, required: true },
  name: { type: String, required: true },
  subject: { type: String, required: true },
});

EmailTemplateSchema.plugin(timestamp);

const EmailTemplateModel = mongoose.model(
  "EmailTemplates",
  EmailTemplateSchema,
  "EmailTemplates"
);

module.exports = EmailTemplateModel;
