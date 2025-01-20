const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const ExchangeRateSchema = new mongoose.Schema({
    currency: { type: String, required: true },
    rate: { type: Number, required: true },
    logs: [
        {
        value: { type: Number, required: true },
        date: { type: Date, required: true },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
            required: true,
        },
        },
    ],
    });

ExchangeRateSchema.plugin(timestamp);

const ExchangeRateModel = mongoose.model( "ExchangeRate", ExchangeRateSchema, "ExchangeRate" );

module.exports = ExchangeRateModel;