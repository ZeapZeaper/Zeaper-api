
const { validateBodyMeasurements } = require("../helpers/utils");
const { getAuthUser } = require("../middleware/firebaseUserAuth");
const BodyMeasurementTemplateModel = require("../models/bodyMeasurementTemplate");



const addBodyMeasurementTemplate = async (req, res) => {
  try {
    const { name, measurements, user_id } = req.body;
    if (!name) {
      return res.status(400).send({ error: "required name" });
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
          "You are not authorized to create Body Measurement Template for this user",
      });
    }
    if (!validateBodyMeasurements(measurements)) {
      return res.status(400).send({
        error:
          "Invalid measurements. Please provide valid measurements in the required schema",
      });
    }
    const bodyMeasurementTemplate = new BodyMeasurementTemplateModel({
      user: user_id || authUser._id,
      name,
      measurements,
    });
    const bodyMeasurementTemplateRes = await bodyMeasurementTemplate.save();
    if (!bodyMeasurementTemplateRes?._id) {
      return res
        .status(400)
        .send({ error: "Body Measurement Template not created" });
    }
    return res
      .status(200)
      .send({ message: "Body Measurement Template created successfully" });
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
    const { name, measurements, user_id, template_id } = req.body;
    if (!name) {
      return res.status(400).send({ error: "required name" });
    }
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
          "You are not authorized to update Body Measurement Template for this user",
      });
    }
    if (!validateBodyMeasurements(measurements)) {
      return res.status(400).send({
        error:
          "Invalid measurements. Please provide valid measurements in the required schema",
      });
    }
    const bodyMeasurementTemplate =
      await BodyMeasurementTemplateModel.findOneAndUpdate(
        { _id: template_id },
        { name, measurements },
        { new: true }
      );
    if (!bodyMeasurementTemplate?._id) {
      return res
        .status(400)
        .send({ error: "Body Measurement Template not updated" });
    }
    return res
      .status(200)
      .send({ message: "Body Measurement Template updated successfully" });
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

module.exports = {
  addBodyMeasurementTemplate,
  getBodyMeasurementTemplates,
  getAuthUserBodyMeasurementTemplates,
  getBodyMeasurementTemplate,
  updateBodyMeasurementTemplate,
  deleteBodyMeasurementTemplate,
};
