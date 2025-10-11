const {
  userVariables,
  shopVariables,
  orderVariables,
  productOrderVariables,
} = require("../helpers/constants");
const EmailTemplateModel = require("../models/emailTemplate");

const validateBodyVariables = (body, variables) => {
  
  // get strings inside all squared brackets
  const regex = /\[(.*?)\]/g;
  let m;
  let error;
  const bodyVariables = [];
  while ((m = regex.exec(body)) !== null) {
    if (m.index === regex.lastIndex) {
      regex.lastIndex++;
    }
    bodyVariables.push(m[1]);
  }

  bodyVariables.map((variable) => {
    const found = variables.find((v) => v === variable);

    if (!found) {
      error = `Variable ${variable} is not allowed. Allowed variables are ${variables.join(
        ", "
      )}`;
    }
  });
  if (error) {
    return { error };
  }
  return true;
};

const addEmailTemplate = async (req, res) => {
  try {
    const { name, body, subject } = req.body;

    if (!name) {
      return res.status(400).send({ error: "name is required" });
    }
    if (!body) {
      return res.status(400).send({ error: "body is required" });
    }
    if (!subject) {
      return res.status(400).send({ error: "subject is required" });
    }
    const validateBody = validateBodyVariables(body, [
      ...userVariables,
      ...shopVariables,
      ...orderVariables,
      ...productOrderVariables
    ]);
    if (validateBody.error) {
      return res.status(400).send({ error: validateBody.error });
    }

    const exist = await EmailTemplateModel.findOne({
      name,
    });
    if (exist) {
      //update
      exist.body = body;
      exist.subject = subject;
      await exist.save();
      return res
        .status(200)
        .send({ data: exist, message: "Email template updated successfully" });
    }
    const emailTemplate = new EmailTemplateModel({
      name,
      body,
      subject,
    });

    await emailTemplate.save();
    res.status(200).send({
      data: emailTemplate,
      message: "Email template added successfully",
    });
  } catch (err) {
    return { error: err.message };
  }
};

const getEmailTemplates = async (req, res) => {
  try {
    const emailTemplates = await EmailTemplateModel.find().lean();
    res.status(200).send({ data: emailTemplates });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const getEmailTemplate = async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).send({ error: "name is required" });
    }
    const emailTemplate = await EmailTemplateModel.findOne({ name }).lean();
    if (!emailTemplate) {
      return res.status(200).send({ data: {} });
    }
    res.status(200).send({ data: emailTemplate });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

module.exports = {
  addEmailTemplate,
  getEmailTemplates,
  getEmailTemplate,
};
