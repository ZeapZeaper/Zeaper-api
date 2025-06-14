const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const blogCommentSchema = new mongoose.Schema({
  blogPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BlogPosts",
    required: true,
  },
  fullName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  comment: {
    type: String,
    required: true,
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BlogComments",
    required: false,
  },
  childrenComments: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BlogComments",
    },
  ],
});
blogCommentSchema.plugin(timestamp);
const BlogCommentModel = mongoose.model(
  "BlogComments",
  blogCommentSchema,
  "BlogComments"
);
module.exports = BlogCommentModel;
