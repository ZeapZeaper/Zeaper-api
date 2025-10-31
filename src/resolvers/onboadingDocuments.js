const { storageRef } = require("../config/firebase");
const { deleteLocalFile, deleLocalImages } = require("../helpers/utils");
const path = require("path");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const OnboardingDocumentModel = require("../models/onboadingDocuments");
const { onboardingDocumentEnums } = require("../helpers/constants");
const { getAuthUser } = require("../middleware/firebaseUserAuth");

//saving image to firebase storage
const addImage = async (destination, filename) => {
  let url = {};
  if (filename) {
    const source = path.join(root + "/uploads/" + filename);
    await sharp(source)
      .resize(1500, 1500, {
        fit: "inside",
        withoutEnlargement: true,
      })
      // .jpeg({ quality: 90 })
      .toFile(path.resolve(destination, "resized", filename));

    const storage = await storageRef.upload(
      path.resolve(destination, "resized", filename),
      // path.resolve(source),
      {
        public: true,
        destination: `shop/${filename}`,
        metadata: {
          firebaseStorageDownloadTokens: uuidv4(),
          cacheControl: "public, max-age=31536000", // 1 year
        },
      }
    );
    // get the public url that avoids egress charges
    url = {
      link: `https://storage.googleapis.com/${storageRef.name}/shop/${filename}`,
      name: filename,
    };
    const deleteSourceFile = await deleteLocalFile(source);
    const deleteResizedFile = await deleteLocalFile(
      path.resolve(destination, "resized", filename)
    );
    await Promise.all([deleteSourceFile, deleteResizedFile]);
    return url;
  }
  return url;
};

const deleteImageFromFirebase = async (name) => {
  if (name) {
    storageRef
      .file("shop/" + name)
      .delete()
      .then(() => {
        return true;
      })
      .catch((err) => {
        console.error("Error deleting image from Firebase:", err);
        return false;
      });
  }
};
const uploadOnboardingDocument = async (req, res) => {
  try {
    const { slug, shopId } = req.body;
    if (!slug) {
      return res.status(400).send({ error: "required slug" });
    }
    if (!shopId) {
      return res.status(400).send({ error: "required shopId" });
    }
    if (!onboardingDocumentEnums.includes(slug)) {
      return res.status(400).send({ error: "Invalid slug" });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).send({ error: "No file uploaded" });
    }
    const user = req?.cachedUser || (await getAuthUser(req));
    if (user.shopId !== shopId && !user?.isAdmin && !user?.superAdmin) {
      await deleLocalImages(req.files);
      return res
        .status(400)
        .send({ error: "You are not authorized to edit this product" });
    }
    const file = req.files[0];

    const imageUrl = await addImage(path.join(root, "uploads"), file.filename);
    const existingDocument = await OnboardingDocumentModel.findOne({
      shop: shopId,
      slug,
    });
    if (existingDocument) {
      // Delete old image from Firebase
      await deleteImageFromFirebase(existingDocument.imageUrl.name);

      existingDocument.imageUrl = imageUrl;
      await existingDocument.save();
      return res.status(200).send({ data: existingDocument });
    } else {
      const newDocument = new OnboardingDocumentModel({
        shop: shopId,
        slug,
        imageUrl,
      });
      await newDocument.save();
      return res
        .status(200)
        .send({
          data: newDocument,
          message: "Onboarding document uploaded successfully",
        });
    }
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const getShopOnboardingDocuments = async (req, res) => {
  try {
    const { shopId } = req.params;
    if (!shopId) {
      return res.status(400).send({ error: "required shopId" });
    }
    const user = req?.cachedUser || (await getAuthUser(req));
    if (user.shopId !== shopId && !user?.isAdmin && !user?.superAdmin) {
      return res
        .status(400)
        .send({ error: "You are not authorized to view these documents" });
    }
    const documents = await OnboardingDocumentModel.find({
      shop: shopId,
    }).lean();
    const data = onboardingDocumentEnums.map((slug) => {
      const doc = documents.find((d) => d.slug === slug);
      return {
        slug,
        imageUrl: doc ? doc.imageUrl : null,
      };
    });
    return res.status(200).send({ data });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
module.exports = {
  uploadOnboardingDocument,
  getShopOnboardingDocuments,
};
