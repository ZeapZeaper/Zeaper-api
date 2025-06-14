const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const BlogPostSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  blogPostId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  tags: [{ type: String, required: false }],
  image: {
    link: { type: String, required: false },
    name: { type: String, required: false },
  },
  status: {
    type: String,
    required: true,
    enum: ["draft", "published", "archived"],
    default: "draft",
  },
  impressions: { type: Number, required: false, default: 0 },
  
});
BlogPostSchema.plugin(timestamp);
const BlogPostModel = mongoose.model("BlogPosts", BlogPostSchema, "BlogPosts");
module.exports = BlogPostModel;
