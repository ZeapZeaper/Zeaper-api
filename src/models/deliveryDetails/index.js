const mongoose = require("mongoose");

 const deliveryDetailsSchema = new mongoose.Schema({
  address: { type: String, required: true },
  region: { type: String, required: true },
  country: { type: String, required: true, default: "nigeria" },
  phoneNumber: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  postCode: { type: String, required: false },
  deliveryNote: { type: String, required: false, trim: true, maxlength: 500 },
});

exports.deliveryDetailsSchema = deliveryDetailsSchema;