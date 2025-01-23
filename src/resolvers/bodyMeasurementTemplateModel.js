const { get } = require("lodash");
const {
  validateBodyMeasurements,
  getBodyMeasurementEnumsFromGuide,
} = require("../helpers/utils");
const { getAuthUser } = require("../middleware/firebaseUserAuth");
const BodyMeasurementTemplateModel = require("../models/bodyMeasurementTemplate");

const addBodyMeasurementTemplate = async (req, res) => {
  try {
    const { templateName, measurements, user_id } = req.body;
    if (!templateName) {
      return res.status(400).send({ error: "required template name" });
    }
    if (!measurements) {
      return res
        .status(400)
        .send({ error: "required measurements and must be array" });
    }

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    if (
      !authUser.isAdmin &&
      !authUser.isSuperAdmin &&
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
    const bodyMeasurementEnums = await getBodyMeasurementEnumsFromGuide();
    const validate = validateBodyMeasurements(measurements, bodyMeasurementEnums);
    if (validate.error) {
      return res.status(400).send({ error: validate.error });
    }

    const bodyMeasurementTemplate = new BodyMeasurementTemplateModel({
      user: user_id || authUser._id,
      templateName,
      measurements,
    });
    const bodyMeasurementTemplateRes = await bodyMeasurementTemplate.save();
    if (!bodyMeasurementTemplateRes?._id) {
      return res
        .status(400)
        .send({ error: "Body Measurement Template not created" });
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
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    if (
      !authUser.isAdmin &&
      !authUser.isSuperAdmin &&
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
    const authUser = await getAuthUser(req);
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
    const { templateName, measurements, user_id } = req.body;
    if (!templateName) {
      return res.status(400).send({ error: "required template name" });
    }
    const exist = await BodyMeasurementTemplateModel.findOne({ templateName });
    if (!exist) {
      return res
        .status(400)
        .send({ error: "Body Measurement Template not found" });
    }

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    if (
      !authUser.isAdmin &&
      !authUser.isSuperAdmin &&
      authUser._id.toString() !== user_id
    ) {
      return res.status(400).send({
        error:
          "You are not authorized to update Body Measurement Template for this user",
      });
    }
    const bodyMeasurementEnums = await getBodyMeasurementEnumsFromGuide();
    if (!validateBodyMeasurements(measurements, bodyMeasurementEnums)) {
      return res.status(400).send({
        error:
          "Invalid measurements. Please provide valid measurements in the required schema",
      });
    }
    const bodyMeasurementTemplate =
      await BodyMeasurementTemplateModel.findOneAndUpdate(
        { templateName },
        { templateName, measurements },
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
    const { user_id, template_id } = req.query;
    if (!template_id) {
      return res.status(400).send({ error: "required template_id" });
    }
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    if (
      !authUser.isAdmin &&
      !authUser.isSuperAdmin &&
      authUser._id.toString() !== user_id
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
module.exports = {
  addBodyMeasurementTemplate,
  getBodyMeasurementTemplates,
  getAuthUserBodyMeasurementTemplates,
  getBodyMeasurementTemplate,
  getBodyMeasurementEums,
  updateBodyMeasurementTemplate,
  deleteBodyMeasurementTemplate,
};
