const { getBodyMeasurementEnumsFromGuide } = require("../helpers/utils");
const BodyMeasurementModel = require("../models/bodyMeasurement");
const BodyMeasurementGuideModel = require("../models/bodyMeasurementGuide");
const ProductModel = require("../models/products");

const validateBodyMeasurement = (measurements, bodyMeasurementEnums) => {
  let error;
  if (!measurements || !measurements.length) {
    error = "Please provide a valid array of measurements";
    return { error };
  }
  for (let i = 0; i < measurements.length; i++) {
    const measurement = measurements[i];
    const { name, fields } = measurement;
    if (!name) {
      error = "One or more body measurements has no name";
      return { error };
    }

    const validItem = bodyMeasurementEnums.find(
      (m) =>
        m.name.toLowerCase().replaceAll(/\s/g, "") ===
        name.toLowerCase().replaceAll(/\s/g, "")
    );

    if (!validItem) {
      error = `Invalid measurement name: ${name}. Note that names are case sensitive valid measurement names are ${bodyMeasurementEnums
        .map((m) => m.name)
        .join(", ")}`;
      return { error };
    }
    if (
      !fields ||
      !fields.length ||
      !Array.isArray(fields) ||
      !fields.every((field) => typeof field === "string")
    ) {
      error = "Invalid fields. Please provide a valid fields array of strings";
      return { error };
    }
    const validFields = validItem.fields;
    if (!fields.every((field) => validFields.includes(field))) {
      error = `Invalid fields. Note that fields are case sensitive  valid fields for ${name} are ${validFields.join(
        ", "
      )}`;
      return { error };
    }
  }
  if (error) {
    return { error };
  }
  return true;
};

const addBodyMeasurement = async (req, res) => {
  try {
    const { productId, measurements, currentStep } = req.body;

    if (!productId) {
      return res.status(400).send({ error: "required productId" });
    }
    if (!measurements || !measurements.length) {
      return res.status(400).send({ error: "required measurements" });
    }
    const bodyMeasurementEnums = await BodyMeasurementGuideModel.find().lean();

    const mappedBodyMeasurementEnums = bodyMeasurementEnums.map((b) => {
      const { name, fields } = b;
      return {
        name,
        fields: fields.map((f) => f.field),
      };
    });
    const measurementNames = measurements.map((m) => m.name);
    const mergedBodyMeasurementEnums = mappedBodyMeasurementEnums
      .reduce((acc, cur) => {
        const found = acc.find((m) => m.name === cur.name);
        if (found) {
          found.fields = [...found.fields, ...cur.fields];
        } else {
          acc.push(cur);
        }
        return acc;
      }, [])
      .filter((m) => measurementNames.includes(m.name));


    const validate = validateBodyMeasurement(
      measurements,
      mergedBodyMeasurementEnums
    );
    if (validate.error) {
      return res.status(400).send({ error: validate.error });
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
      if (currentStep) {
        const updateProduct = await ProductModel.findOneAndUpdate(
          { productId },
          { currentStep },
          { new: true }
        );
      }
      return res.status(200).send({
        data: updatedMeasurement,
        message: "Measurement updated successfully",
      });
    }
    if (currentStep) {
      const updateProduct = await ProductModel.findOneAndUpdate(
        { productId },
        { currentStep },
        { new: true }
      );
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
    }).lean();
    const product = await ProductModel.findOne({
      productId,
    });
    const gender = product?.categories?.gender[0] || "Female";

    const data = {
      gender,
      ...measurement,
    };

    return res
      .status(200)
      .send({ data, message: "Measurement fetched successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

module.exports = {
  addBodyMeasurement,
  getProductBodyMeasurement,
};
