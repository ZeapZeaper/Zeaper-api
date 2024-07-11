const {
  genderEnums,
  ageGroupEnums,
  shoeTypeEnums,
  topEnums,
  bottomEnums,
  productTypeEnums,
} = require("../../helpers/constants");
const {  checkForDuplicates } = require("../../helpers/utils");
const ReadyMadeClothes = require("../../models/products/readyMadeCloth");
const ReadyMadeShoes = require("../../models/products/readyMadeShoes");
const ShopModel = require("../../models/shop");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const path = require("path");
const {
  editReadyMadeClothes,
  deleteReadyMadeClothes,
  restoreReadyMadeClothes,
  createReadyMadeClothes,
} = require("./readyMadeClothes");
const { storageRef } = require("../../config/firebase");
const root = require("../../../root");

//saving image to firebase storage
const addImage = async (req, filename) => {
  let url = {};
  if (filename) {
    const source = path.join(root + "/uploads/" + filename);
    await sharp(source)
      .resize(1024, 1024)
      .jpeg({ quality: 90 })
      .toFile(path.resolve(req.file.destination, "resized", filename));
    const storage = await storageRef.upload(
      path.resolve(req.file.destination, "resized", filename),
      {
        public: true,
        destination: `/product/${filename}`,
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
      .file("/user/" + name)
      .delete()
      .then(() => {
        return true;
      })
      .catch((err) => {
        console.log("err is", err);
        return false;
      });
  }
};

const handleImageUpload = async (files) => {
  const newPictures = [];
  if (files) {
    for (let i = 0; i < files?.length; i++) {
      const file = files[i];

      const filename = file.filename;
      const destination = file.destination;

      const url = await addImage(destination, filename);

      newPictures.push(url);
    }
  }

  return newPictures;
};

const editProduct = async (req, res) => {
  try {
    let productType;
    const param = req.body;
    const { productId,  variations, sizes, colors } = param;
    if (variations) {
      return res.status(400).send({
        error: "editing variations through this endpoint is not allowed",
      });
    }
    if (sizes) {
      return res
        .status(400)
        .send({ error: "editing sizes through this endpoint is not allowed" });
    }
    if (colors) {
      return res
        .status(400)
        .send({ error: "editing colors through this endpoint is not allowed" });
    }
    if (!productId) {
      return res.status(400).send({ error: "productId is required" });
    }
    
    


    const promises = [];
    promises.push(ReadyMadeClothes.findOne({ productId }).exec());
    promises.push(ReadyMadeShoes.findOne({ productId }).exec());
    const [readyMadeCloth, readyMadeShoe] = await Promise.all(promises);
    if (!readyMadeCloth && !readyMadeShoe) {
      return res.status(400).send({ error: "product not found" });
    }

    let editedProduct;
    if (readyMadeCloth) {
      productType = "readyMadeCloth";
      editedProduct = await editReadyMadeClothes(param);
    }
    if (readyMadeShoe) {
      productType = "readyMadeShoe";
    }
    return res
      .status(200)
      .send({ data: editedProduct, message: "product edited successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const deleteProducts = async (req, res) => {
  try {
    const param = req.body;
    const { productIds } = param;
    if (!productIds || !productIds.length) {
      return res.status(400).send({ error: "productid is required" });
    }


    const promises = [];
    promises.push(
      deleteReadyMadeClothes(param)
      //   deleteReadyMadeShoes(param)
    );
    await Promise.all(promises);
    return res.status(200).send({ message: "products deleted successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const restoreProducts = async (req, res) => {
  try {
    const param = req.body;
    const { productIds } = param;
    if (!productIds || !productIds.length) {
      return res.status(400).send({ error: "productid is required" });
    }


    const promises = [];
    promises.push(
      restoreReadyMadeClothes(param)
      //   deleteReadyMadeShoes(param)
    );
    await Promise.all(promises);
    return res.status(200).send({ message: "products restored successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
function getRandomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}
const getProuctTypePrefix = (productType) => {
  if (productType === "readyMadeCloth") {
    return "RMC";
  }
  if (productType === "readyMadeShoe") {
    return "RMS";
  }
  return "";
};
const generateProductId = async (shopId, productType) => {
  let productId = "";
  let found = true;
  const promises = [];

  do {
    productId = `${shopId}/${getProuctTypePrefix(productType)}/${getRandomInt(
      1000000,
      9999999
    )}`;
    promises.push(ReadyMadeClothes.findOne({ productId }).exec());
    promises.push(ReadyMadeShoes.findOne({ productId }).exec());
    const [readyMadeCloth, readyMadeShoe] = await Promise.all(promises);
    if (!readyMadeCloth && !readyMadeShoe) {
      found = false;
    }
  } while (found);
  return productId;
};

const validateColors = (colors, pictures) => {
  let valid = true;
  const colorImages = colors.map((color) => color.imageNames).flat()
  const imageNames = pictures.map((picture) => picture.filename);
  colorImages.forEach((color) => {
    color.forEach((image) => {
      if (imageNames.indexOf(image) === -1) {
        valid = false;
      }
    });
  });
  return valid;
};

const createProduct = async (req, res) => {
  try {
    const param = req.body;
    const {
      productType,
      title,
      subTitle,
      description,
      sizes,
      colors,
      categories,
    } = param;
    console.log("param");
    if (!productType) {
      return res.status(400).send({ error: "productType is required" });
    }
    if (!title) {
      return res.status(400).send({ error: "title is required" });
    }
    if (!subTitle) {
      return res.status(400).send({ error: "subTitle is required" });
    }
    if (!description) {
      return res.status(400).send({ error: "description is required" });
    }

    if (
      !sizes ||
      !Array.isArray(sizes) ||
      sizes.length === 0 ||
      checkForDuplicates(sizes)
    ) {
      return res
        .status(400)
        .send({ error: "sizes field is a required array with unique values" });
    }
    if (!colors || !Array.isArray(colors) || colors.length === 0) {
      return res.status(400).send({
        error: "colors field is a required array of object with unique values",
      });
    }
    // check for duplicates in color.value in colors array
    const colorValues = colors.map((color) => color.value);
    if (checkForDuplicates(colorValues)) {
      return res
        .status(400)
        .send({ error: "color value must be unique in the colors array" });
    }
    if (!categories || Object.keys(categories).length === 0) {
      return res.status(400).send({ error: "categories is required" });
    }
    const gender = categories?.gender;
    if (!gender) {
      return res.status(400).send({ error: "gender category is required" });
    }
    if (genderEnums.indexOf(gender) === -1) {
      return res.status(400).send({ error: "invalid gender category" });
    }
    const ageGroup = categories?.ageGroup;
    if (ageGroup && ageGroupEnums.indexOf(ageGroup) === -1) {
      return res.status(400).send({ error: "invalid ageGroup category" });
    }
    const top = categories?.top;
    if (top && topEnums.indexOf(top) === -1) {
      return res.status(400).send({ error: "invalid top category" });
    }
    const bottom = categories?.bottom;
    if (bottom && bottomEnums.indexOf(bottom) === -1) {
      return res.status(400).send({ error: "invalid bottom category" });
    }
    if (productTypeEnums.indexOf(productType) === -1) {
      return res.status(400).send({ error: "invalid productType" });
    }

    if (productType === "readyMadeShoe") {
      const { shoeType } = categories;
      if (!shoeType) {
        return res.status(400).send({ error: "shoeType category is required" });
      }
      if (shoeTypeEnums.indexOf(shoeType) === -1) {
        return res.status(400).send({ error: "invalid shoeType category" });
      }
    }



    if (!user?.shopId) {
      return res.status(400).send({ error: "User does not have a shop" });
    }
    if (!user?.shopEnabled) {
      return res.status(400).send({ error: "User's shop is disabled" });
    }
    const shop = await ShopModel.findOne({ shopId: user.shopId });
    if (!shop) {
      return res.status(400).send({ error: "shop not found" });
    }
    let images = [{}];
    let 
    if (req.files && req.files.length > 0) {
      const isColorValid = validateColors(colors, req.files?.pictures);
      if (!isColorValid) {
        return res.status(400).send({
          error: "color images must be included in the uploaded images",
        });
      }
      const upload = await handleImageUpload([...req.files?.pictures]);

      const docs = await Promise.all(upload);
      images = docs;
    }
   

    const productId = await generateProductId(user.shopId, productType);

    param.shopId = user.shopId;
    param.productId = productId;
    param.postedBy = user._id;
    param.shop = shop._id;
    param.images = images;
    let createdProduct;
    if (productType === "readyMadeCloth") {
      createdProduct = await createReadyMadeClothes(param);
    }
    if (productType === "readyMadeShoe") {
      // createdProduct = await createReadyMadeShoes(param);
    }

    return res
      .status(200)
      .send({ data: createdProduct, message: "product created successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

module.exports = {
  editProduct,
  deleteProducts,
  restoreProducts,
  createProduct,
};
