const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");


const ReviewSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  user:{type:mongoose.Schema.Types.ObjectId,ref:"Users",required:true},
  rating: { type: Number, required: true },
  title: { type: String, required: true },
  review: { type: String, required: true },
  displayName: { type: String, required: true },
  disabled: { type: Boolean, required: false, default: false },
  likes: {
    value : { type: Number, required: false, default: 0 },
    users: [{type:mongoose.Schema.Types.ObjectId}]
  },
  dislikes: {
    value : { type: Number, required: false, default: 0 },
    users: [{type:mongoose.Schema.Types.ObjectId}]
  },
  imageMatch:{type:Boolean,required:true},



  
});
ReviewSchema.plugin(timestamp);

const ReviewModel = mongoose.model("Reviews", ReviewSchema, "Reviews");

module.exports = ReviewModel;
