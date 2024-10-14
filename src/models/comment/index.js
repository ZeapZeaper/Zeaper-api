"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");
const { type } = require("../../config/firebaseServiceAcc");




const CommentSchema = new mongoose.Schema({
    userId :{type: String, required: false},
    commentBy:{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
            required: true,
        },
    comment: { type: String, required: true },
    shopId : {type: String, required: false},
    productId : {type: String, required: false},
    type : {type: String, required: true},



});

CommentSchema.plugin(timestamp);

const CommentModel = mongoose.model("Comments", CommentSchema, "Comments");

module.exports = CommentModel;
