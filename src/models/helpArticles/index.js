const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");
const { helpCenterCategoryEnums, helpCenterSubCategoryEnums } = require("../../helpers/constants");

const HelpArticleSchema = new mongoose.Schema({
    title: { type: String, required: true },
    articleId: { type: String, required: true, unique: true },
    content: { type: String, required: true },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
        required: false,
    },
    tags: [{ type: String }],
    category: { type: String, required: true, enum:helpCenterCategoryEnums },
    subCategory: { type: String, required: true, enum: helpCenterSubCategoryEnums },
    isPopular: { type: Boolean, default: false },
});
HelpArticleSchema.plugin(timestamp);
const HelpArticleModel = mongoose.model(
  "HelpArticles",
  HelpArticleSchema,
  "HelpArticles"
);
module.exports = HelpArticleModel;
