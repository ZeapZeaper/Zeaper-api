const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const VoucherSchema = new mongoose.Schema({
    code: { type: String, required: true },
    amount: { type: Number, required: true },
    expiryDate: { type: Date, required: true },
    isUsed: { type: Boolean, required: false, default: false },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
        required: true,
    },
    });

VoucherSchema.plugin(timestamp);

const VoucherModel = mongoose.model("Vouchers", VoucherSchema, "Vouchers");

module.exports = VoucherModel;