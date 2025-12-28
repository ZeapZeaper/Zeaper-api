const { get } = require("lodash");
const {
  validateBodyMeasurements,
  getBodyMeasurementEnumsFromGuide,
} = require("../helpers/utils");
const { getAuthUser } = require("../middleware/firebaseUserAuth");
const BodyMeasurementTemplateModel = require("../models/bodyMeasurementTemplate");
const BodyMeasurementGuideModel = require("../models/bodyMeasurementGuide");
const BodyMeasurementGuideFieldModel = require("../models/BodyMeasurementGuideField");
const UserModel = require("../models/user");

const addBodyMeasurementTemplate = async (req, res) => {
  try {
    const { templateName, measurements, user_id, gender } = req.body;
    if (!templateName) {
      return res.status(400).send({ error: "required template name" });
    }
    if (!gender) {
      return res.status(400).send({ error: "required gender" });
    }

    if (!measurements) {
      return res
        .status(400)
        .send({ error: "required measurements and must be array" });
    }
    // if measurements is not array
    if (!Array.isArray(measurements)) {
      return res.status(400).send({ error: "measurements must be array" });
    }
    if (measurements.length === 0) {
      return res.status(400).send({ error: "measurements must not be empty" });
    }

    const bodyMeasurementGuideFields =
      await BodyMeasurementGuideFieldModel.find().lean();

    // if measurement item is not object containing field and value
    // field must be in bodyMeasurementGuideFields
    // value must be number
    let measurementInvalidError;

    const isValidMeasurement = measurements.every((measurement, index) => {
      if (typeof measurement !== "object") {
        measurementInvalidError = `measurement at index ${index} must be object`;
        return false;
      }

      const { field, value } = measurement;

      if (!field) {
        measurementInvalidError = `measurement at index ${index} must contain field`;
        return false;
      }
      if (!value) {
        measurementInvalidError = `measurement at index ${index} must contain value`;
        return false;
      }
      if (typeof value !== "number") {
        measurementInvalidError = `measurement at index ${index} value must be number`;
        return false;
      }
      const fieldExist = bodyMeasurementGuideFields.find(
        (f) => f.field === field
      );
      if (!fieldExist) {
        measurementInvalidError = `measurement at index ${index} field ${field} does not exist`;
        return false;
      }
      return true;
    });
    if (!isValidMeasurement) {
      return res.status(400).send({
        error: measurementInvalidError,
      });
    }

    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    if (
      !authUser.isAdmin &&
      !authUser.superAdmin &&
      user_id &&
      authUser._id.toString() !== user_id
    ) {
      return res.status(400).send({
        error:
          "You are not authorized to create Body Measurement Template for this user",
      });
    }
    const alreadyExist = await BodyMeasurementTemplateModel.findOne({
      templateName,
      user: user_id || authUser._id,
    });
    if (alreadyExist) {
      return res.status(400).send({
        error: "Body Measurement Template with this name already exist",
      });
    }

    const formattedMeasurements = measurements.map((measurement) => {
      measurement.unit = "inch";
      return measurement;
    });
    const bodyMeasurementTemplate = new BodyMeasurementTemplateModel({
      user: user_id || authUser._id,
      templateName,
      gender,
      measurements: formattedMeasurements,
    });
    const bodyMeasurementTemplateRes = await bodyMeasurementTemplate.save();
    if (!bodyMeasurementTemplateRes?._id) {
      return res
        .status(400)
        .send({ error: "Body Measurement Template not created" });
    }
    // if successful and user is guest, increase the usermodel expiresAt by 30 days
    if (authUser.isGuest) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      await UserModel.findByIdAndUpdate(authUser._id, { expiresAt });
    }
    return res.status(200).send({
      message: "Body Measurement Template created successfully",
      data: bodyMeasurementTemplateRes,
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const getBodyMeasurementTemplates = async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).send({ error: "required user_id" });
    }
    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    if (
      !authUser.isAdmin &&
      !authUser.superAdmin &&
      user_id &&
      authUser._id.toString() !== user_id
    ) {
      return res.status(400).send({
        error:
          "You are not authorized to fetch Body Measurement Templates for this user",
      });
    }
    const bodyMeasurementTemplates = await BodyMeasurementTemplateModel.find({
      user: user_id,
    });
    return res.status(200).send({
      data: bodyMeasurementTemplates,
      message: "Body Measurement Templates fetched successfully",
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const getAuthUserBodyMeasurementTemplates = async (req, res) => {
  try {
    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    const bodyMeasurementTemplates = await BodyMeasurementTemplateModel.find({
      user: authUser._id,
    });
    return res.status(200).send({
      data: bodyMeasurementTemplates,
      message: "Body Measurement Templates fetched successfully",
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const getBodyMeasurementTemplate = async (req, res) => {
  try {
    const { template_id } = req.query;
    if (!template_id) {
      return res.status(400).send({ error: "required template_id" });
    }
    const bodyMeasurementTemplate = await BodyMeasurementTemplateModel.findOne({
      _id: template_id,
    });
    if (!bodyMeasurementTemplate?._id) {
      return res
        .status(400)
        .send({ error: "Body Measurement Template not found" });
    }
    return res.status(200).send({
      data: bodyMeasurementTemplate,
      message: "Body Measurement Template fetched successfully",
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const updateBodyMeasurementTemplate = async (req, res) => {
  try {
    const { template_id, measurements, user_id } = req.body;
    if (!template_id) {
      return res.status(400).send({ error: "required template _id" });
    }

    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    if (
      user_id &&
      !authUser.isAdmin &&
      !authUser.superAdmin &&
      authUser._id.toString() !== user_id
    ) {
      return res.status(400).send({
        error:
          "You are not authorized to update Body Measurement Template for this user",
      });
    }
    const exist = await BodyMeasurementTemplateModel.findOne({
      _id: template_id,
      user: user_id || authUser._id,
    }).lean();

    if (!exist) {
      return res
        .status(400)
        .send({ error: "Body Measurement Template not found" });
    }

    const bodyMeasurementEnums = await BodyMeasurementGuideModel.find().lean();
    const mappedBodyMeasurementEnums = bodyMeasurementEnums.map((b) => {
      const { name, fields } = b;
      return {
        name,
        fields: fields.map((f) => f.field),
      };
    });
    const mergedBodyMeasurementEnums = mappedBodyMeasurementEnums.reduce(
      (acc, cur) => {
        const found = acc.find((m) => m.name === cur.name);
        if (found) {
          found.fields = [...found.fields, ...cur.fields];
        } else {
          acc.push(cur);
        }
        return acc;
      },
      []
    );
    const validate = validateBodyMeasurements(
      measurements,
      mergedBodyMeasurementEnums
    );
    if (!validate) {
      return res.status(400).send({
        error:
          "Invalid measurements. Please provide valid measurements in the required schema",
      });
    }
    const bodyMeasurementTemplate =
      await BodyMeasurementTemplateModel.findOneAndUpdate(
        { _id: template_id },
        { measurements },
        { new: true }
      );
    if (!bodyMeasurementTemplate?._id) {
      return res
        .status(400)
        .send({ error: "Body Measurement Template not updated" });
    }
    return res.status(200).send({
      message: "Body Measurement Template updated successfully",
      data: bodyMeasurementTemplate,
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const deleteBodyMeasurementTemplate = async (req, res) => {
  try {
    const { user_id, template_id } = req.body;
    if (!template_id) {
      return res.status(400).send({ error: "required template_id" });
    }
    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    if (
      !authUser.isAdmin &&
      !authUser.superAdmin &&
      authUser._id.toString() !== user_id &&
      user_id
    ) {
      return res.status(400).send({
        error:
          "You are not authorized to delete Body Measurement Template for this user",
      });
    }
    const bodyMeasurementTemplate =
      await BodyMeasurementTemplateModel.findOneAndDelete({ _id: template_id });
    if (!bodyMeasurementTemplate?._id) {
      return res
        .status(400)
        .send({ error: "Body Measurement Template not deleted" });
    }
    return res
      .status(200)
      .send({ message: "Body Measurement Template deleted successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const getBodyMeasurementEums = async (req, res) => {
  try {
    const bodyMeasurementEums = await getBodyMeasurementEnumsFromGuide();
    return res.status(200).send({
      data: bodyMeasurementEums,
      message: "Body Measurement Eums fetched successfully",
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const getBodyMeasurementTemplateFields = async (req, res) => {
  try {
    const bodyMeasurementFields = [];
    const bodyMeasurementGuide = await BodyMeasurementGuideModel.find().lean();
    const bodyMeasurementGuideFields =
      await BodyMeasurementGuideFieldModel.find().lean();
    return res.status(200).send({
      data: bodyMeasurementFields,
      message: "Body Measurement Eums fetched successfully",
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
module.exports = {
  addBodyMeasurementTemplate,
  getBodyMeasurementTemplates,
  getAuthUserBodyMeasurementTemplates,
  getBodyMeasurementTemplate,
  getBodyMeasurementEums,
  updateBodyMeasurementTemplate,
  deleteBodyMeasurementTemplate,
};
