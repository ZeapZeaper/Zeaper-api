const BodyMeasurementGuideModel = require("../models/bodyMeasurementGuide");
const { storageRef } = require("../config/firebase"); // reference to our db
const root = require("../../root");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const { deleteLocalFile, deleLocalImages } = require("../helpers/utils");
const { error } = require("console");
const BodyMeasurementGuideFieldModel = require("../models/BodyMeasurementGuideField");

//saving image to firebase storage
const addImage = async (req, filename) => {
  let url = {};
  if (filename) {
    const source = path.join(root + "/uploads/" + filename);
    await sharp(source)
      // .resize(1024, 1024)
      // .jpeg({ quality: 90 })
      .toFile(path.resolve(req.file.destination, "resized", filename));
    const storage = await storageRef.upload(
      path.resolve(req.file.destination, "resized", filename),
      {
        public: true,
        destination: `/bodyMeasurementGuide/${filename}`,
        metadata: {
          firebaseStorageDownloadTokens: uuidv4(),
        },
      }
    );
    url = { link: storage[0].metadata.mediaLink, name: filename };
    const deleteSourceFile = await deleteLocalFile(source);
    const deleteResizedFile = await deleteLocalFile(
      path.resolve(req.file.destination, "resized", filename)
    );
    await Promise.all([deleteSourceFile, deleteResizedFile]);
    return url;
  }
  return url;
};

const deleteImageFromFirebase = async (name) => {
  if (name) {
    storageRef
      .file("/bodyMeasurementGuide/" + name)
      .delete()
      .then(() => {
        return true;
      })
      .catch((err) => {
        return false;
      });
  }
};

const checkImageInUse = async (name) => {
  const bodyMeasurementGuide = await BodyMeasurementGuideModel.findOne({
    "fields.imageUrl.name": name,
  });
  if (bodyMeasurementGuide) {
    return true;
  }
  return false;
};

const getBodyMeasurementGuide = async (req, res) => {
  try {
    const { gender } = req.query;
    if (!gender) {
      return res.status(400).send({
        error: "gender field is required",
      });
    }
    const bodyMeasurementGuide = await BodyMeasurementGuideModel.find({
      gender,
    }).lean();
    // update field.imageUrl from string to object with link and name properties and remove the old imageUrl property in the database and save
    // const promises = bodyMeasurementGuide.map(async (guide) => {
    //   const fields = guide.fields.map((field) => {
    //     return { ...field, imageUrl: { link: "", name: "" }, description: "" };
    //   });
    //   console.log("f", fields);
    //   guide.fields = fields;
    //     await BodyMeasurementGuideModel.findByIdAndUpdate(guide._id, guide, {
    //       new: true,
    //     });
    // });
    // await Promise.all(promises);

    return res.status(200).send({ data: bodyMeasurementGuide });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const getFieldImagesGallery = async (req, res) => {
  try {
    const images = await BodyMeasurementGuideModel.find()
      .select("fields")
      .lean();
    const gallery = images
      .map((item) => {
        return item.fields.map((field) => {
          if (field.imageUrl.name) {
            return {
              imageUrl: field.imageUrl.link,
              title: field.field,
            };
          }
        });
      })
      .flat()
      .filter((item) => item !== undefined && item !== null && item !== "");

    // ensure that imageUrl is not null or empty

    return res.status(200).send({ data: gallery });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const updateFieldImage = async (req, res) => {
  try {
    const { fieldId, existingLink } = req.body;

    if (!req.file && !existingLink) {
      return res.status(400).send({ error: "no file uploaded" });
    }

    if (req.file && existingLink) {
      await deleLocalImages([req.file]);
      return res.status(400).send({ error: "Only one image is required" });
    }

    const bodyMeasurementGuide = await BodyMeasurementGuideModel.findOne({
      "fields._id": fieldId,
    });
    if (!bodyMeasurementGuide) {
      return res.status(404).send({ error: "Field not found" });
    }
    if (existingLink) {
      const exist = await BodyMeasurementGuideModel.findOne({
        "fields.imageUrl.link": existingLink,
      });

      if (!exist) {
        return res.status(404).send({ error: "Image not found" });
      }
      const imageUrlName = exist.fields.find(
        (field) => field.imageUrl.link === existingLink
      ).imageUrl.name;
      console.log("imageUrlName", imageUrlName);

      const fieldIndex = bodyMeasurementGuide.fields.findIndex(
        (field) => field._id.toString() === fieldId
      );
      if (bodyMeasurementGuide.fields[fieldIndex].imageUrl.name) {
        const isImageInUse = await checkImageInUse(
          bodyMeasurementGuide.fields[fieldIndex].imageUrl.name
        );
        if (!isImageInUse) {
          await deleteImageFromFirebase(
            bodyMeasurementGuide.fields[fieldIndex].imageUrl.name
          );
        }
      }
      bodyMeasurementGuide.fields[fieldIndex].imageUrl = {
        link: existingLink,
        name: imageUrlName,
      };
      console.log(
        "bodyMeasurementGuide",
        bodyMeasurementGuide.fields[fieldIndex]
      );
      await bodyMeasurementGuide.save();
      return res.status(200).send({ data: bodyMeasurementGuide });
    }

    const filename = req.file.filename;

    if (bodyMeasurementGuide) {
      const imageUrl = await addImage(req, filename);
      const fieldIndex = bodyMeasurementGuide.fields.findIndex(
        (field) => field._id.toString() === fieldId
      );
      if (bodyMeasurementGuide.fields[fieldIndex].imageUrl.name) {
        const isImageInUse = await checkImageInUse(
          bodyMeasurementGuide.fields[fieldIndex].imageUrl.name
        );
        if (!isImageInUse) {
          await deleteImageFromFirebase(
            bodyMeasurementGuide.fields[fieldIndex].imageUrl.name
          );
        }
      }
      bodyMeasurementGuide.fields[fieldIndex].imageUrl = imageUrl;
      await bodyMeasurementGuide.save();
      return res.status(200).send({ data: bodyMeasurementGuide });
    }
    if (!bodyMeasurementGuide) {
      return res.status(404).send({ error: "Field not found" });
    }
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const editBodyMeasurementField = async (req, res) => {
  try {
    const { fieldId, field, description } = req.body;
    if (!fieldId) {
      return res.status(400).send({ error: "required fieldId" });
    }
    if (!field) {
      return res.status(400).send({ error: "required field" });
    }
    if (!description) {
      return res.status(400).send({ error: "required description" });
    }

    const bodyMeasurementGuide = await BodyMeasurementGuideModel.findOne({
      "fields._id": fieldId,
    });
    if (!bodyMeasurementGuide) {
      return res.status(404).send({ error: "Field not found" });
    }
    const fieldIndex = bodyMeasurementGuide.fields.findIndex(
      (field) => field._id.toString() === fieldId
    );
    bodyMeasurementGuide.fields[fieldIndex].field = field;
    bodyMeasurementGuide.fields[fieldIndex].description = description;

    await bodyMeasurementGuide.save();
    return res.status(200).send({ data: bodyMeasurementGuide });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const deleteBodyMeasurementField = async (req, res) => {
  try {
    const { fieldId } = req.body;
    if (!fieldId) {
      return res.status(400).send({ error: "required fieldId" });
    }
    const bodyMeasurementGuide = await BodyMeasurementGuideModel.findOne({
      "fields._id": fieldId,
    });
    if (!bodyMeasurementGuide) {
      return res.status(404).send({ error: "Field not found" });
    }
    const fieldIndex = bodyMeasurementGuide.fields.findIndex(
      (field) => field._id.toString() === fieldId
    );
    if (bodyMeasurementGuide.fields[fieldIndex].imageUrl.name) {
      const isImageInUse = await checkImageInUse(
        bodyMeasurementGuide.fields[fieldIndex].imageUrl.name
      );
      if (!isImageInUse) {
        await deleteImageFromFirebase(
          bodyMeasurementGuide.fields[fieldIndex].imageUrl.name
        );
      }
    }
    bodyMeasurementGuide.fields.splice(fieldIndex, 1);
    await bodyMeasurementGuide.save();
    return res.status(200).send({ data: bodyMeasurementGuide });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const deleteBodyMeasurementFieldImage = async (req, res) => {
  try {
    const { fieldId } = req.body;
    const bodyMeasurementGuide = await BodyMeasurementGuideModel.findOne({
      "fields._id": fieldId,
    });
    if (!bodyMeasurementGuide) {
      return res.status(404).send({ error: "Field not found" });
    }
    const fieldIndex = bodyMeasurementGuide.fields.findIndex(
      (field) => field._id.toString() === fieldId
    );
    if (bodyMeasurementGuide.fields[fieldIndex].imageUrl.name) {
      const isImageInUse = await checkImageInUse(
        bodyMeasurementGuide.fields[fieldIndex].imageUrl.name
      );
      if (!isImageInUse) {
        await deleteImageFromFirebase(
          bodyMeasurementGuide.fields[fieldIndex].imageUrl.name
        );
      }
    }
    bodyMeasurementGuide.fields[fieldIndex].imageUrl = { link: "", name: "" };
    await bodyMeasurementGuide.save();
    return res.status(200).send({ data: bodyMeasurementGuide });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const deleteBodyMeasurementGuide = async (req, res) => {
  try {
    const { bodyMeasurementGuide_id } = req.body;
    if (!bodyMeasurementGuide_id) {
      return res
        .status(400)
        .send({ error: "required bodyMeasurementGuide_id" });
    }
    const bodyMeasurementGuide =
      await BodyMeasurementGuideModel.findByIdAndDelete(
        bodyMeasurementGuide_id
      );
    if (!bodyMeasurementGuide) {
      return res
        .status(404)
        .send({ error: "Body Measurement Guide not found" });
    }
    return res.status(200).send({
      data: bodyMeasurementGuide,
      message: "Body Measurement Guide deleted successfully",
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const updateBodyMeasurementGuideName = async (req, res) => {
  try {
    const { bodyMeasurementGuide_id, name } = req.body;
    if (!bodyMeasurementGuide_id) {
      return res
        .status(400)
        .send({ error: "required bodyMeasurementGuide_id" });
    }
    if (!name) {
      return res.status(400).send({ error: "required name" });
    }
    const bodyMeasurementGuide = await BodyMeasurementGuideModel.findById(
      bodyMeasurementGuide_id
    );
    if (!bodyMeasurementGuide) {
      return res
        .status(404)
        .send({ error: "Body Measurement Guide not found" });
    }
    bodyMeasurementGuide.name = name;
    await bodyMeasurementGuide.save();
    return res.status(200).send({ data: bodyMeasurementGuide });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const addBodyMeasurementGuideField = async (req, res) => {
  try {
    const { bodyMeasurementGuide_id, field, description } = req.body;
    if (!bodyMeasurementGuide_id) {
      return res
        .status(400)
        .send({ error: "required bodyMeasurementGuide_id" });
    }
    if (!field) {
      return res.status(400).send({ error: "required field" });
    }
    if (!description) {
      return res.status(400).send({ error: "required description" });
    }
    const bodyMeasurementGuide = await BodyMeasurementGuideModel.findById(
      bodyMeasurementGuide_id
    );
    if (!bodyMeasurementGuide) {
      return res
        .status(404)
        .send({ error: "Body Measurement Guide not found" });
    }
    // check if field already exists

    const fieldExists = bodyMeasurementGuide.fields.find(
      (f) => f.field.trim().toLowerCase() === field.trim().toLowerCase()
    );
    if (fieldExists) {
      return res.status(400).send({ error: "Field already exists" });
    }
    const newField = {
      field,
      imageUrl: { link: "", name: "" },
      description,
    };
    bodyMeasurementGuide.fields.push(newField);
    await bodyMeasurementGuide.save();
    return res.status(200).send({ data: bodyMeasurementGuide });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const addBodyMeasurementGuide = async (req, res) => {
  try {
    const { name, gender } = req.body;
    if (!name) {
      return res.status(400).send({ error: "required name" });
    }
    if (!gender) {
      return res.status(400).send({ error: "required gender" });
    }
    if (gender !== "male" && gender !== "female") {
      return res.status(400).send({ error: "gender must be male or female" });
    }
    // check if name already exists
    const nameExists = await BodyMeasurementGuideModel.findOne({
      name,
    });
    if (nameExists) {
      return res.status(400).send({ error: "Name already exists" });
    }
    const bodyMeasurementGuide = new BodyMeasurementGuideModel({
      name,
      gender,
      fields: [],
    });
    await bodyMeasurementGuide.save();
    return res.status(200).send({ data: bodyMeasurementGuide });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const getBodyMeasurementGuideFields = async (req, res) => {
  try {
    const bodyMeasurementGuideFields =
      await BodyMeasurementGuideFieldModel.find().lean();
    return res.status(200).send({ data: bodyMeasurementGuideFields });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

module.exports = {
  getBodyMeasurementGuide,
  getFieldImagesGallery,
  updateFieldImage,
  editBodyMeasurementField,
  deleteBodyMeasurementField,
  deleteBodyMeasurementFieldImage,
  deleteBodyMeasurementGuide,
  updateBodyMeasurementGuideName,
  addBodyMeasurementGuideField,
  addBodyMeasurementGuide,
  getBodyMeasurementGuideFields,
};
