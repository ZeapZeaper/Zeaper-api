const BodyMeasurementModel = require("../models/bodyMeasurement");
const ProductModel = require("../models/products");

const validateBodyMeasurement = (measurements) => {
  if (!measurements || !measurements.length) {
    return false;
  }
  for (let i = 0; i < measurements.length; i++) {
    const measurement = measurements[i];
    if (
      !measurement.name ||
      !measurement.fields ||
      !measurement.fields.length ||
      !Array.isArray(measurement.fields) ||
      !measurement.fields.every((field) => typeof field === "string")
    ) {
      return false;
    }
  }
  return true;
};

const addBodyMeasurement = async (req, res) => {
  try {
    const { productId, measurements } = req.body;

    if (!productId) {
      return res.status(400).send({ error: "required productId" });
    }
    if (!measurements || !measurements.length) {
      return res.status(400).send({ error: "required measurements" });
    }
    if (!validateBodyMeasurement(measurements)) {
      return res.status(400).send({
        error:
          "Invalid measurements. Please provide valid measurements in the required schema. Ensure measurements is an array of objects with name and fields array of strings",
      });
    }
    const product = await ProductModel.findOne({ productId });
    if (!product) {
      return res.status(404).send({ error: "Product not found" });
    }

    const existedProductBodyMeasurement = await BodyMeasurementModel.findOne({
      productId,
    });
    if (existedProductBodyMeasurement) {
       
      const updatedMeasurement = await BodyMeasurementModel.findOneAndUpdate(
        { productId },
        { measurements },
        { new: true }
      );
      return res.status(200).send({
        data: updatedMeasurement,
        message: "Measurement updated successfully",
      });
    }
   
    const newBodyMeasurement = new BodyMeasurementModel({
      productId: productId,
      measurements,
    });
    const savedBodyMeasurement = await newBodyMeasurement.save();
    if (!savedBodyMeasurement?._id) {
      return res.status(400).send({ error: "Body Measurement not created" });
    }
    const productBodyMeasurement = await ProductModel.findOneAndUpdate(
      { productId },
      { bodyMeasurement: savedBodyMeasurement._id },
      { new: true }
    );
    if (!productBodyMeasurement?._id) {
      return res
        .status(400)
        .send({ error: "Product Body Measurement not updated" });
    }
    return res.status(200).send({
      data: {
        bodyMeasurement: savedBodyMeasurement,
        product: productBodyMeasurement,
      },
      message: "Measurement created successfully",
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const getProductBodyMeasurement = async (req, res) => {
  try {
    const { productId } = req.query;
    if (!productId) {
      return res.status(400).send({ error: "required productId" });
    }
    const measurement = await BodyMeasurementModel.findOne({
      productId,
    });
    return res
      .status(200)
      .send({ data: measurement, message: "Measurement fetched successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

module.exports = {
  addBodyMeasurement,
  getProductBodyMeasurement,
};
