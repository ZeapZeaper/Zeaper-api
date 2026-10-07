const {
  validateBodyMeasurements,
  getBodyMeasurementEnumsFromGuide,
} = require("../helpers/utils");
const { getAuthUser } = require("../middleware/firebaseUserAuth");
const BodyMeasurementTemplateModel = require("../models/bodyMeasurementTemplate");
const UserModel = require("../models/user");

const getGuideMeasurementsByGender = async (gender) => {
  const normalizedGender = String(gender || "").toLowerCase();
  const bodyMeasurementEnums = await getBodyMeasurementEnumsFromGuide();
  const clothMeasurements =
    bodyMeasurementEnums?.cloth?.find((item) => item.gender === normalizedGender)
      ?.value || [];
  const shoeMeasurements =
    bodyMeasurementEnums?.shoe?.find((item) => item.gender === normalizedGender)
      ?.value || [];

  return [...clothMeasurements, ...shoeMeasurements].reduce((acc, current) => {
    const found = acc.find((item) => item.name === current.name);
    if (found) {
      found.fields = [...new Set([...found.fields, ...current.fields])];
    } else {
      acc.push({
        name: current.name,
        fields: [...current.fields],
      });
    }
    return acc;
  }, []);
};

const isFlatTemplateMeasurement = (measurement) =>
  measurement && !measurement.name && measurement.field;

const groupFlatTemplateMeasurements = (measurements, guideMeasurements) => {
  const groupedMeasurements = [];

  for (const measurement of measurements) {
    if (typeof measurement !== "object") {
      return { error: "Each measurement must be an object" };
    }

    const { field, value, unit } = measurement;

    if (!field) {
      return { error: "Each measurement must contain field" };
    }
    if (value === null || value === undefined || value === "") {
      return { error: `Measurement field ${field} must contain value` };
    }
    if (typeof value !== "number") {
      return { error: `Measurement field ${field} value must be number` };
    }

    const guideMeasurement = guideMeasurements.find((item) =>
      item.fields.includes(field),
    );

    if (!guideMeasurement) {
      return {
        error: `Measurement field ${field} does not exist for gender ${measurement.gender || "selected"}`,
      };
    }

    let groupedItem = groupedMeasurements.find(
      (item) => item.name === guideMeasurement.name,
    );

    if (!groupedItem) {
      groupedItem = {
        name: guideMeasurement.name,
        measurements: [],
      };
      groupedMeasurements.push(groupedItem);
    }

    groupedItem.measurements.push({
      field,
      value,
      unit: unit || "inch",
    });
  }

  return { data: groupedMeasurements };
};

const normalizeTemplateMeasurements = (measurements) =>
  measurements.map((measurement) => ({
    ...measurement,
    measurements: (measurement.measurements || []).map((item) => ({
      ...item,
      unit: item.unit || "inch",
    })),
  }));

const validateTemplateMeasurements = async ({ measurements, gender }) => {
  if (!Array.isArray(measurements)) {
    return { error: "measurements must be array" };
  }

  if (measurements.length === 0) {
    return { error: "measurements must not be empty" };
  }

  const guideMeasurements = await getGuideMeasurementsByGender(gender);
  if (!guideMeasurements.length) {
    return { error: `No body measurement guide found for gender ${gender}` };
  }

  const groupedMeasurements = measurements.every(isFlatTemplateMeasurement)
    ? groupFlatTemplateMeasurements(measurements, guideMeasurements)
    : { data: normalizeTemplateMeasurements(measurements) };

  if (groupedMeasurements.error) {
    return groupedMeasurements;
  }

  const validation = validateBodyMeasurements(
    groupedMeasurements.data,
    guideMeasurements,
  );

  if (validation?.error) {
    return validation;
  }

  return { data: groupedMeasurements.data };
};

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

    const validatedMeasurements = await validateTemplateMeasurements({
      measurements,
      gender,
    });
    if (validatedMeasurements.error) {
      return res.status(400).send({ error: validatedMeasurements.error });
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

    const bodyMeasurementTemplate = new BodyMeasurementTemplateModel({
      user: user_id || authUser._id,
      templateName,
      gender,
      measurements: validatedMeasurements.data,
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

    const validate = await validateTemplateMeasurements({
      measurements,
      gender: exist.gender,
    });
    if (validate.error) {
      return res.status(400).send({
        error: validate.error,
      });
    }
    const bodyMeasurementTemplate =
      await BodyMeasurementTemplateModel.findOneAndUpdate(
        { _id: template_id },
        { measurements: validate.data },
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
