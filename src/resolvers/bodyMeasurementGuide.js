const BodyMeasurementGuideModel = require("../models/bodyMeasurementGuide");
const { storageRef } = require("../config/firebase"); // reference to our db
const root = require("../../root");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const { deleteLocalFile } = require("../helpers/utils");

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
    const bodyMeasurementGuide = await BodyMeasurementGuideModel.find().lean();
    return res.status(200).send({ data: bodyMeasurementGuide });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const getFieldImagesLibrary = async (req, res) => {
  try {
    const images = await BodyMeasurementGuideModel.find()
      .select("fields.imageUrl")
      .lean();
    return res.status(200).send({ data: images });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const updateFieldImage = async (req, res) => {
  try {
    const { fieldId } = req.params;
    if (!fieldId) {
      return res.status(400).send({ error: "FieldId is required" });
    }
    if (!req.file) {
      return res.status(400).send({ error: "no file uploaded" });
    }
    const bodyMeasurementGuide = await BodyMeasurementGuideModel.findOne({
      "fields._id": fieldId,
    });
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

module.exports = {
  getBodyMeasurementGuide,
  getFieldImagesLibrary,
  updateFieldImage,
};
