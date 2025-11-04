const { storageRef } = require("../config/firebase");
const {
  deleteLocalFile,
  deleLocalImages,
  deleteLocalImagesByFileName,
} = require("../helpers/utils");
const path = require("path");
const root = require("../../root");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const OnboardingDocumentModel = require("../models/onboadingDocuments");
const { onboardingDocumentEnums } = require("../helpers/constants");
const { getAuthUser } = require("../middleware/firebaseUserAuth");
const ShopModel = require("../models/shop");
const fs = require("fs");

const addImageOrPdf = async (destination, filename, fileType) => {
  if (!filename) return {};

  const source = path.join(root, "uploads", filename);
  if (!fs.existsSync(source)) throw new Error(`File not found: ${source}`);

  // detect type automatically if not specified
  const isPdf =
    fileType === "application/pdf" || filename.toLowerCase().endsWith(".pdf");

  const destPath = isPdf
    ? path.resolve(destination, "resized", filename)
    : path.resolve(destination, "resized", filename);

  // ensure resized folder exists
  fs.mkdirSync(path.resolve(destination, "resized"), { recursive: true });

  try {
    if (!isPdf) {
      // process image via sharp
      await sharp(source)
        .resize(1500, 1500, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .toFile(destPath);
    } else {
      // for PDFs, just copy file directly
      fs.copyFileSync(source, destPath);
    }

    // upload to storage
    const storage = await storageRef.upload(destPath, {
      public: true,
      destination: `shop/${filename}`,
      metadata: {
        firebaseStorageDownloadTokens: uuidv4(),
        cacheControl: "public, max-age=31536000", // 1 year
      },
    });

    // construct public URL
    const url = {
      link: `https://storage.googleapis.com/${storageRef.name}/shop/${filename}`,
      name: filename,
      filetype: isPdf ? "pdf" : "image",
    };

    // clean up local files
    await Promise.all([deleteLocalFile(source), deleteLocalFile(destPath)]);

    return url;
  } catch (err) {
    console.error("Error processing file:", err);
    throw err;
  }
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
  let firebaseImageUrl = null;
  try {
    const { slug, shopId } = req.body;
    if (!slug) {
      return res.status(400).send({ error: "required slug" });
    }
    if (!shopId) {
      return res.status(400).send({ error: "required shopId" });
    }
    const onboardingDocumentEnumSlugs = onboardingDocumentEnums.map(
      (item) => item.slug
    );
    if (!req.file) {
      return res.status(400).send({ error: "No file uploaded" });
    }
    if (!onboardingDocumentEnumSlugs.includes(slug)) {
      await deleteLocalImagesByFileName(req.file.filename);

      return res.status(400).send({ error: "Invalid slug" });
    }

    const user = req?.cachedUser || (await getAuthUser(req));
    if (user.shopId !== shopId && !user?.isAdmin && !user?.superAdmin) {
      await deleteLocalImagesByFileName(req.file.filename);
      return res
        .status(400)
        .send({ error: "You are not authorized to edit this product" });
    }
    const shop = await ShopModel.findOne({ shopId });
    if (!shop) {
      await deleteLocalImagesByFileName(req.file.filename);
      return res.status(400).send({ error: "Shop not found" });
    }
    const file = req.file;

    const imageUrl = await addImageOrPdf(
      path.join(root, "uploads"),
      file.filename,
      file.mimetype
    );
    firebaseImageUrl = imageUrl;
    const existingDocument = await OnboardingDocumentModel.findOne({
      shopId,
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
        shopId,
        shop: shop._id,
        slug,
        imageUrl,
      });
      await newDocument.save();
      return res.status(200).send({
        data: newDocument,
        message: "Onboarding document uploaded successfully",
      });
    }
  } catch (err) {
    if (req?.file) {
      await deleteLocalImagesByFileName(req.file.filename);
    }
    if (firebaseImageUrl) {
      await deleteImageFromFirebase(firebaseImageUrl.name);
    }

    return res.status(500).send({ error: err.message });
  }
};

const getShopOnboardingDocuments = async (req, res) => {
  try {
    const { shopId } = req.query;
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
      shopId,
    }).lean();
    const data = onboardingDocumentEnums.map((doc) => {
      const document = documents.find((d) => d.slug === doc.slug);
      return {
        slug: doc.slug,
        link: document ? document.imageUrl.link : null,
        label: doc.label,
        filetype: document ? document.imageUrl.filetype : null,
      };
    });
    return res
      .status(200)
      .send({ data, message: "Documents fetched successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
module.exports = {
  uploadOnboardingDocument,
  getShopOnboardingDocuments,
};
