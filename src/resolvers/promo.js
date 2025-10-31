const PromoModel = require("../models/promo");
const { storageRef } = require("../config/firebase"); // reference to our db
const ProductModel = require("../models/products");
const { productTypeEnums } = require("../helpers/constants");
const { getAuthUser } = require("../middleware/firebaseUserAuth");
const {
  deleteLocalFile,
  deleteLocalImagesByFileName,
  deleteRedisKeysByPrefix,
} = require("../helpers/utils");
const root = require("../../root");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const ShopModel = require("../models/shop");
const { addPreferredAmountAndCurrency } = require("./products/productHelpers");
const { type } = require("os");
const redis = require("../helpers/redis");
const { ENV } = require("../config");

// saving video to firebase storage
/**
 * Upload a video file to Firebase Storage with optimized caching
 * and a public, egress-safe URL
 */
const addVideo = async (filename) => {
  if (!filename) return {};

  const source = path.join(root, "uploads", filename);
  const destination = `promo/${filename}`;
  const token = uuidv4();

  try {
    // Upload to Firebase storage
    const [uploadedFile] = await storageRef.upload(source, {
      destination,
      metadata: {
        cacheControl: "public, max-age=31536000, immutable", // 1 year cache
        firebaseStorageDownloadTokens: token,
      },
    });

    // ✅ Use egress-safe URL (avoid download/storage/v1)
    const publicUrl = `https://storage.googleapis.com/${storageRef.name}/${destination}`;

    // Clean up local file
    await deleteLocalFile(source);

    return {
      link: publicUrl,
      name: filename,
      type: "video",
      size: uploadedFile.metadata.size,
      contentType: uploadedFile.metadata.contentType,
      cacheControl: uploadedFile.metadata.cacheControl,
    };
  } catch (err) {
    console.error("❌ Error uploading video:", err);
    return {};
  }
};
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
      .toFile(path.resolve(destination, "resized", filename));
    const storage = await storageRef.upload(
      path.resolve(destination, "resized", filename),
      {
        public: true,
        destination: `/promo/${filename}`,
        metadata: {
          cacheControl: "public, max-age=31536000, immutable", // 1 year caching
          firebaseStorageDownloadTokens: uuidv4(),
        },
      }
    );
    url = {
      // get the public url that avoids egress charges
      link: `https://storage.googleapis.com/${storageRef.name}/promo/${filename}`,
      name: filename,
      type: "image",
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
      .file("/user/" + name)
      .delete()
      .then(() => {
        return true;
      })
      .catch((err) => {
        return false;
      });
  }
};

function getRandomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const generateUniquePromoId = async () => {
  let promoId;
  let found = true;

  do {
    const randomVal = getRandomInt(1000000, 9999999);
    promoId = `${randomVal}`;
    const exist = await PromoModel.findOne(
      {
        promoId,
      },
      { lean: true }
    );

    if (exist) {
      found = true;
    } else {
      found = false;
    }
  } while (found);

  return promoId.toString();
};

// Helper to create cache key per promo
const makePromoCacheKey = (promoId) => `promo:${promoId}`;
// 5️⃣ Invalidate cache when a product joins/leaves promo
const invalidatePromoCache = async (promoId) => {
  if (!promoId) return;
  const cacheKey = makePromoCacheKey(promoId);
  await redis.del(cacheKey);
};

const validatePromo = (param) => {
  const {
    startDate,
    endDate,
    description,
    title,
    subTitle,
    discount,
    permittedProductTypes,
  } = param;

  if (!startDate) {
    return { error: "startDate is required" };
  }
  if (!endDate) {
    return { error: "endDate is required" };
  }
  if (!description) {
    return { error: "description is required" };
  }
  if (!title) {
    return { error: "title is required" };
  }

  if (!subTitle) {
    return { error: "subTitle is required" };
  }
  if (!discount) {
    return { error: "discount is required" };
  }
  const { type, fixedPercentage, rangePercentage } = discount;
  if (!type) {
    return { error: "discount type is required" };
  }
  if (type !== "range" && type !== "fixed") {
    return { error: "Invalid discount type" };
  }
  if (type === "fixed" && !fixedPercentage) {
    return {
      error: "fixedPercentage is required since discount type is fixed",
    };
  }
  if (
    type === "range" &&
    (!rangePercentage || !rangePercentage.min || !rangePercentage.max)
  ) {
    return {
      error: "rangePercentage is required since discount type is range",
    };
  }
  if (fixedPercentage && (fixedPercentage < 0 || fixedPercentage > 100)) {
    return { error: "fixedPercentage must be between 0 and 100" };
  }
  if (
    rangePercentage &&
    (rangePercentage.min < 0 ||
      rangePercentage.min > 100 ||
      rangePercentage.max < 0 ||
      rangePercentage.max > 100)
  ) {
    return { error: "rangePercentage must be between 0 and 100" };
  }
  if (rangePercentage && rangePercentage.min > rangePercentage.max) {
    return { error: "rangePercentage min is greater than max" };
  }
  if (permittedProductTypes && !Array.isArray(permittedProductTypes)) {
    return { error: "permittedProductTypes must be an array" };
  }

  if (permittedProductTypes && permittedProductTypes.length > 0) {
    const invalidProductTypes = permittedProductTypes.filter(
      (type) => !productTypeEnums.includes(type)
    );
    if (invalidProductTypes.length > 0) {
      return { error: "Invalid product types" };
    }
  }
  if (startDate < new Date()) {
    return { error: "Promo start date is passed" };
  }
  if (endDate < new Date()) {
    return { error: "Promo end date is passed" };
  }
  if (startDate > endDate) {
    return { error: "Promo start date is greater than end date" };
  }
  return true;
};

const createPromo = async (req, res) => {
  let imageUrl = {};
  try {
    if (typeof req.body.discount === "string") {
      req.body.discount = JSON.parse(req.body.discount);
    }
    if (typeof req.body?.permittedProductTypes === "string") {
      req.body.permittedProductTypes = JSON.parse(
        req.body.permittedProductTypes
      );
    }
    if (typeof req.body?.startDate === "string") {
      req.body.startDate = new Date(req.body.startDate);
    }
    if (typeof req.body?.endDate === "string") {
      req.body.endDate = new Date(req.body.endDate);
    }
    const {
      startDate,
      endDate,
      description,
      title,
      subTitle,
      discount,
      permittedProductTypes,
      type,
    } = req.body;

    if (!req.files) {
      return res.status(400).send({ error: "cover image file is required" });
    }
    const validation = validatePromo(req.body);
    if (validation !== true) {
      if (req?.files) {
        Object.values(req.files).map(async (file) => {
          await deleteLocalImagesByFileName(file[0].filename);
        });
      }
      return res.status(400).send({ error: validation.error });
    }
    // mate start date time 00:00:00 and end date time 23:59:59

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const user = await getAuthUser(req);
    if (!user) {
      if (req?.files) {
        Object.values(req.files).map(async (file) => {
          await deleteLocalImagesByFileName(file[0].filename);
        });
      }
      return res.status(400).send({ error: "User not found" });
    }
    if (!user?.isAdmin && !user?.superAdmin) {
      if (req?.files) {
        Object.values(req.files).map(async (file) => {
          await deleteLocalImagesByFileName(file[0].filename);
        });
      }
      return res
        .status(400)
        .send({ error: "You are not authorized to create promo" });
    }
    let smallScreenImageUrl = {};
    let largeScreenImageUrl = {};

    if (req?.files?.smallScreenImageUrl) {
      if (type === "video") {
        smallScreenImageUrl = await addVideo(
          req.files.smallScreenImageUrl[0].filename
        );
      } else {
        smallScreenImageUrl = await addImage(
          req.files.smallScreenImageUrl[0].destination,
          req.files.smallScreenImageUrl[0].filename
        );
      }
    }

    if (req.files.largeScreenImageUrl) {
      if (type === "video") {
        largeScreenImageUrl = await addVideo(
          req.files.largeScreenImageUrl[0].filename
        );
      } else {
        largeScreenImageUrl = await addImage(
          req.files.largeScreenImageUrl[0].destination,
          req.files.largeScreenImageUrl[0].filename
        );
      }
    }

    const promoId = await generateUniquePromoId();
    const promoData = {
      promoId,
      startDate,
      endDate,
      description,
      title,

      subTitle,
      discount,
      permittedProductTypes,
      smallScreenImageUrl,
      largeScreenImageUrl,
    };
    const promoInstance = new PromoModel(promoData);
    await promoInstance.save();
    res
      .status(201)
      .send({ data: promoInstance, message: "Promo created successfully" });
  } catch (error) {
    if (imageUrl.name) {
      await deleteImageFromFirebase(imageUrl.name);
    }
    if (req?.files) {
      Object.values(req.files).map(async (file) => {
        console.log("here 3", file);
        await deleteLocalImagesByFileName(file[0].filename);
      });
    }
    res.status(400).send({ error: error.message });
  }
};

const getPromos = async (req, res) => {
  try {
    const promos = await PromoModel.find().lean();

    return res
      .status(200)
      .send({ data: promos, message: "Promos fetched successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const getAvailablePromos = async (req, res) => {
  try {
    const promos = await PromoModel.find({
      status: { $in: ["live", "scheduled"] },
    }).lean();
    // sort promos by createdAt descending
    promos.sort((a, b) => b.createdAt - a.createdAt);
    return res
      .status(200)
      .send({ data: promos, message: "Promos fetched successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const getLivePromos = async (req, res) => {
  try {
    const { permittedProductTypes } = req.query;
    const redisKey = `${ENV}:live_promos:${permittedProductTypes || "all"}`;
    // 1️⃣ Check cache
    let cachedPromos = await redis.get(redisKey);
    if (cachedPromos) {
      return res.status(200).send({
        data: JSON.parse(cachedPromos),
        message: "Promos fetched successfully (from cache)",
      });
    }

    // 2️⃣ Query promos directly
    const filter = { status: "live" };

    if (permittedProductTypes) {
      const typesArray = permittedProductTypes.split(",").map((t) => t.trim());
      filter.permittedProductTypes = { $in: typesArray };
    } else {
      filter.permittedProductTypes = { $in: productTypeEnums };
    }

    const promos = await PromoModel.find(filter).lean();

    // 3️⃣ Compute productsCount from productIds
    const promosWithCounts = promos.map((promo) => ({
      ...promo,
      productsCount: promo.productIds?.length || 0,
    }));

    // 4️⃣ Cache result in Redis
    await redis.set(redisKey, JSON.stringify(promosWithCounts));

    return res.status(200).send({
      data: promosWithCounts,
      message: "Promos fetched successfully",
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const getScheduledPromos = async (req, res) => {
  try {
    const promos = await PromoModel.find({
      status: "scheduled",
    });
    return res
      .status(200)
      .send({ data: promos, message: "Promos fetched successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const getDraftPromos = async (req, res) => {
  try {
    const promos = await PromoModel.find({
      status: "draft",
    });
    return res
      .status(200)
      .send({ data: promos, message: "Promos fetched successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const getFinishedPromos = async (req, res) => {
  try {
    const promos = await PromoModel.find({
      status: "expired",
    });
    return res
      .status(200)
      .send({ data: promos, message: "Promos fetched successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const getPromo = async (req, res) => {
  try {
    const { promoId } = req.query;
    if (!promoId) {
      return res.status(400).send({ error: "promoId is required" });
    }
    const promo = await PromoModel.findOne({ promoId });
    if (!promo) {
      return res.status(400).send({ error: "Promo not found" });
    }
    return res
      .status(200)
      .send({ data: promo, message: "Promo fetched successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const getPromoWithProducts = async (req, res) => {
  try {
    const { promoId } = req.query;
    if (!promoId) {
      return res.status(400).send({ error: "promoId is required" });
    }

    const cacheKey = makePromoCacheKey(promoId);
    await invalidatePromoCache(promoId);
    console.log("🔄 Promo cache invalidated for promoId:", promoId);

    // 1️⃣ Try to get from cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.status(200).send(JSON.parse(cached));
    }

    // 2️⃣ Fetch promo from DB
    const promo = await PromoModel.findOne({ promoId }).lean();
    if (!promo) {
      return res.status(400).send({ error: "Promo not found" });
    }

    // 3️⃣ Fetch products
    const includedProducts = promo.productIds || [];
    const productData = await ProductModel.find({
      productId: { $in: includedProducts },
      status: "live",
    })
      .select({
        title: 1,
        variations: 1,
        colors: 1,
        productId: 1,
        promo: 1,
        createdAt: 1,
      })
      .lean();

    const authUser = req?.cachedUser || (await getAuthUser(req));
    const currency = req.query.currency || authUser?.prefferedCurrency || "NGN";
    const products = addPreferredAmountAndCurrency(productData, currency);

    const response = {
      data: { promo, products },
      message: "Promo fetched successfully",
    };

    // 4️⃣ Cache result in Redis (e.g., 30 mins)
    await redis.set(cacheKey, JSON.stringify(response), { EX: 1800 });

    return res.status(200).send(response);
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const getProductPromo = async (req, res) => {
  try {
    const { productId } = req.query;
    if (!productId) {
      return res.status(400).send({ error: "productId is required" });
    }
    const product = await ProductModel.findOne({ productId });
    if (!product) {
      return res.status(400).send({ error: "Product not found" });
    }
    const promo = await PromoModel.findOne({ promoId: product.promo.promoId });
    return res.status(200).send({
      data: {
        promo,
        product,
      },
      message: "Promo fetched successfully",
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const updatePromo = async (req, res) => {
  try {
    if (typeof req.body.discount === "string") {
      req.body.discount = JSON.parse(req.body.discount);
    }
    if (typeof req.body?.permittedProductTypes === "string") {
      req.body.permittedProductTypes = JSON.parse(
        req.body.permittedProductTypes
      );
    }
    if (typeof req.body?.startDate === "string") {
      req.body.startDate = new Date(req.body.startDate);
    }
    if (typeof req.body?.endDate === "string") {
      req.body.endDate = new Date(req.body.endDate);
    }
    const {
      promoId,
      startDate,
      endDate,
      description,
      title,
      subTitle,
      discount,
      permittedProductTypes,
      type,
    } = req.body;
    if (!promoId) {
      if (req?.files) {
        Object.values(req.files).map(async (file) => {
          await deleteLocalImagesByFileName(file[0].filename);
        });
      }

      return res.status(400).send({ error: "promoId is required" });
    }

    const promo = await PromoModel.findOne({ promoId });
    if (!promo) {
      return res.status(400).send({ error: "Promo not found" });
    }

    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    if (!authUser?.isAdmin && !authUser?.superAdmin) {
      return res
        .status(400)
        .send({ error: "You are not authorized to update promo" });
    }

    // mate start date time 00:00:00 and end date time 23:59:59

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    // if (promo.status !== "draft") {
    //   if (req?.files) {
    //     Object.values(req.files).map(async (file) => {
    //       await deleteLocalImagesByFileName(file[0].filename);
    //     });
    //   }

    //   return res.status(400).send({ error: "Promo is not in draft status" });
    // }
    const validation = validatePromo(req.body);
    if (validation !== true) {
      if (req?.files) {
        Object.values(req.files).map(async (file) => {
          await deleteLocalImagesByFileName(file[0].filename);
        });
      }
      return res.status(400).send({ error: validation.error });
    }
    let smallScreenImageUrl = promo.smallScreenImageUrl;
    let largeScreenImageUrl = promo.largeScreenImageUrl;

    if (req?.files?.smallScreenImageUrl) {
      if (type === "video") {
        smallScreenImageUrl = await addVideo(
          req.files.smallScreenImageUrl[0].filename
        );
      } else {
        smallScreenImageUrl = await addImage(
          req.files.smallScreenImageUrl[0].destination,
          req.files.smallScreenImageUrl[0].filename
        );
      }
    }

    if (req.files.largeScreenImageUrl) {
      if (type === "video") {
        largeScreenImageUrl = await addVideo(
          req.files.largeScreenImageUrl[0].filename
        );
      } else {
        largeScreenImageUrl = await addImage(
          req.files.largeScreenImageUrl[0].destination,
          req.files.largeScreenImageUrl[0].filename
        );
      }
    }
    if (
      promo.smallScreenImageUrl.name &&
      req.file &&
      promo.smallScreenImageUrl.name !== smallScreenImageUrl.name
    ) {
      await deleteImageFromFirebase(promo.smallScreenImageUrl.name);
    }
    if (
      promo.largeScreenImageUrl.name &&
      req.file &&
      promo.largeScreenImageUrl.name !== largeScreenImageUrl.name
    ) {
      await deleteImageFromFirebase(promo.largeScreenImageUrl.name);
    }

    const updatedPromo = await PromoModel.findOneAndUpdate(
      {
        promoId,
      },
      {
        startDate,
        endDate,
        description,
        title,
        subTitle,
        discount,
        permittedProductTypes,
        smallScreenImageUrl,
        largeScreenImageUrl,
      },
      { new: true }
    ).lean();
    return res
      .status(200)
      .send({ data: updatedPromo, message: "Promo updated successfully" });
  } catch (error) {
    if (req?.files) {
      Object.values(req.files).map(async (file) => {
        await deleteLocalImagesByFileName(file[0].filename);
      });
    }
    res.status(400).send({ error: error.message });
  }
};

const deletePromo = async (req, res) => {
  try {
    const { promoId } = req.body;
    if (!promoId) {
      return res.status(400).send({ error: "promoId is required" });
    }
    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    if (!authUser?.isAdmin && !authUser?.superAdmin) {
      return res
        .status(400)
        .send({ error: "You are not authorized to delete promo" });
    }

    const promo = await PromoModel.findOne({ promoId });
    if (!promo) {
      return res.status(400).send({ error: "Promo not found" });
    }
    if (promo.status === "live") {
      return res.status(400).send({ error: "Promo is in live status" });
    }
    const productIds = promo.productIds;
    const products = await ProductModel.find({
      productId: { $in: productIds },
    });

    await PromoModel.deleteOne({ promoId }).exec();
    if (promo.imageUrl.name) {
      await deleteImageFromFirebase(promo.imageUrl.name);
    }
    const newTimeLine = {
      date: new Date(),
      description: `Left promo ${promo.title}/${promo.promoId} due to deletion of promo`,
      actionBy: authUser._id,
    };
    const promises = products.map(async (product) => {
      if (product?.promo?.promoId === promo.promoId) {
        const variations = product.variations.map((variation) => {
          if (variation.discount) {
            delete variation.discount;
          }
          return variation;
        });
        await ProductModel.findOneAndUpdate(
          {
            productId: product.productId,
          },
          { variations, promo: null, $push: { timeLine: newTimeLine } },
          { new: true }
        ).lean();
      }
    });

    await Promise.all(promises);
    return res.status(200).send({ message: "Promo deleted successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const joinPromo = async (req, res) => {
  try {
    const { promoId, productId, discountPercentage, adminControlledDiscount } =
      req.body;
    if (!promoId) {
      return res.status(400).send({ error: "promoId is required" });
    }
    if (!productId) {
      return res.status(400).send({ error: "productId is required" });
    }
    if (!discountPercentage) {
      return res.status(400).send({ error: "discount percentage is required" });
    }
    const promo = await PromoModel.findOne({ promoId });
    if (!promo) {
      return res.status(400).send({ error: "Promo not found" });
    }
    if (promo.status !== "scheduled" && promo.status !== "live") {
      return res
        .status(400)
        .send({ error: "Promo is not in live or scheduled status" });
    }
    const { type, fixedPercentage, rangePercentage } = promo.discount;
    if (type === "fixed" && discountPercentage !== fixedPercentage) {
      return res.status(400).send({
        error: `Fixed discount percentage must be ${fixedPercentage}`,
      });
    }
    if (
      type === "range" &&
      (discountPercentage < rangePercentage.min ||
        discountPercentage > rangePercentage.max)
    ) {
      return res.status(400).send({
        error: `Range discount percentage must be between ${rangePercentage.min} and ${rangePercentage.max}`,
      });
    }

    const user = await getAuthUser(req);
    if (!user) {
      return res.status(400).send({ error: "User not found" });
    }
    const permittedProductTypes = promo.permittedProductTypes;
    const product = await ProductModel.findOne({ productId }).lean();
    if (!product) {
      return res.status(400).send({ error: "Product not found" });
    }

    if (!permittedProductTypes.includes(product.productType)) {
      return res
        .status(400)
        .send({ error: "Product type not allowed to join this promo" });
    }
    //check if product is already in the promo
    if (promo.productIds.includes(productId)) {
      return res.status(400).send({ error: "Product is already in the promo" });
    }
    //check if product is already in another promo
    if (product?.promo?.promoId && product?.promo?.promoId !== promo.promoId) {
      return res.status(400).send({
        error:
          "Product is already in another scheduled or live promo. Please leave that promo first",
      });
    }
    // check if product is already in live or scheduled promo
    const productPromo = product.promo;
    if (productPromo?.promoId) {
      const productPromoInstance = await PromoModel.findOne({
        promoId: productPromo.promoId,
      });
      if (
        productPromoInstance?.status === "live" ||
        productPromoInstance?.status === "scheduled"
      ) {
        return res
          .status(400)
          .send({ error: "Product is already in live or scheduled promo" });
      }
    }

    //check if user can perform this action
    if (!user?.isAdmin && !user?.superAdmin) {
      if (adminControlledDiscount) {
        return res.status(400).send({
          error: "You are not authorized to set vendor controlled discount",
        });
      }
      const shop = await ShopModel.findOne({ shopId: product.shopId });
      if (!shop) {
        return res.status(400).send({ error: "Shop not found" });
      }
      if (shop.userId !== user.userId) {
        return res
          .status(400)
          .send({ error: "You are not authorized to perform this action" });
      }
    }

    const updatedPromo = await PromoModel.findOneAndUpdate(
      {
        promoId,
      },
      {
        $push: { productIds: productId },
      },
      { new: true }
    ).lean();

    let variations = product.variations;
    if (promo?.status === "live") {
      variations = product.variations.map((variation) => {
        const discount =
          variation.price - (variation.price * discountPercentage) / 100;
        return {
          ...variation,
          discount,
        };
      });
    }

    let timeLineDescription = `Product joined promo ${promo.title}/${promo.promoId}`;
    if (promo.status === "live") {
      timeLineDescription = `Product joined live promo ${promo.title}/${promo.promoId} with discount ${discountPercentage}%`;
    }
    const newTimeLine = {
      date: new Date(),
      description: timeLineDescription,
      actionBy: user._id,
    };
    const updatedProduct = await ProductModel.findOneAndUpdate(
      {
        productId,
      },
      {
        promo: {
          promoId: promo.promoId,
          discountPercentage,
          adminControlledDiscount: adminControlledDiscount || false,
        },
        variations,
        $push: { timeLine: newTimeLine },
      },
      { new: true }
    ).lean();
    await deleteRedisKeysByPrefix(`$${ENV}:live_promos`); // deletes the cached live promos
    await invalidatePromoCache(promo.promoId);
    return res.status(200).send({
      data: { promo: updatedPromo, product: updatedProduct },
      message: "Promo joined successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const leavePromo = async (req, res) => {
  try {
    const { promoId, productId } = req.body;
    if (!promoId) {
      return res.status(400).send({ error: "promoId is required" });
    }
    if (!productId) {
      return res.status(400).send({ error: "productId is required" });
    }
    const product = await ProductModel.findOne({
      productId,
    }).lean();
    if (!product) {
      return res.status(400).send({ error: "Product not found" });
    }
    const user = await getAuthUser(req);
    //check if user can perform this action
    if (!user?.isAdmin && !user?.superAdmin) {
      const shop = await ShopModel.findOne({ shopId: product.shopId });
      if (!shop) {
        return res.status(400).send({ error: "Shop not found" });
      }
      if (shop.userId !== user.userId) {
        return res
          .status(400)
          .send({ error: "You are not authorized to perform this action" });
      }
    }
    const promo = await PromoModel.findOne({
      promoId,
    });
    if (!promo) {
      return res.status(400).send({ error: "Promo not found" });
    }

    if (product?.promo?.promoId !== promo.promoId) {
      return res.status(400).send({ error: "Product not in the promo" });
    }
    const updatedPromo = await PromoModel.findOneAndUpdate(
      {
        promoId,
      },
      { $pull: { productIds: productId } },
      { new: true }
    ).lean();
    const variations = product.variations.map((variation) => {
      if (variation.discount) {
        delete variation.discount;
      }

      return { ...variation };
    });
    const newTimeLine = {
      date: new Date(),
      description: `Product left promo ${promo.title}/${promo.promoId}`,
      actionBy: user._id,
    };
    const updatedProduct = await ProductModel.findOneAndUpdate(
      {
        productId,
      },
      { variations, $push: { timeLine: newTimeLine }, promo: null },

      { new: true }
    ).lean();

    await deleteRedisKeysByPrefix(`$${ENV}:live_promos`); // deletes the cached live promos
    await invalidatePromoCache(promo.promoId);
    return res.status(200).send({
      data: { promo: updatedPromo, product: updatedProduct },
      message: "Promo left successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const updatePromoImage = async (req, res) => {
  let imageUrl = {};
  try {
    if (!req.file) {
      return res.status(400).send({ error: "cover image file is required" });
    }
    const { promoId } = req.body;
    const promo = await PromoModel.findOne({ promoId });
    if (!promo) {
      if (req?.files) {
        Object.values(req.files).map(async (file) => {
          console.log("here 3", file);
          await deleteLocalImagesByFileName(file[0].filename);
        });
      }
      return res.status(400).send({ error: "Promo not found" });
    }
    imageUrl = await addImage(req, req.file.filename);
    const updatedPromo = await PromoModel.findOneAndUpdate(
      {
        promoId,
      },
      { imageUrl },
      { new: true }
    ).lean();

    const previousImageUrl = promo.imageUrl;
    if (previousImageUrl.name) {
      await deleteImageFromFirebase(previousImageUrl.name);
    }
    return res.status(200).send({
      data: updatedPromo,
      message: "Promo image updated successfully",
    });
  } catch (error) {
    if (imageUrl.name) {
      await deleteImageFromFirebase(imageUrl.name);
    }
    if (req?.files) {
      Object.values(req.files).map(async (file) => {
        await deleteLocalImagesByFileName(file[0].filename);
      });
    }
    res.status(400).send({ error: error.message });
  }
};
const activatePromo = async (req, res) => {
  try {
    const { promoId } = req.body;
    if (!promoId) {
      return res.status(400).send({ error: "promoId is required" });
    }
    const promo = await PromoModel.findOne({ promoId });
    if (!promo) {
      return res.status(400).send({ error: "Promo not found" });
    }
    if (promo.status !== "scheduled") {
      return res.status(400).send({ error: "Promo is not in draft status" });
    }
    const startDate = promo.startDate;
    const endDate = promo.endDate;
    if (startDate < new Date()) {
      return res.status(400).send({ error: "Promo start date is passed" });
    }
    if (endDate < new Date()) {
      return res.status(400).send({ error: "Promo end date is passed" });
    }
    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    if (!authUser?.isAdmin && !authUser?.superAdmin) {
      return res
        .status(400)
        .send({ error: "You are not authorized to activate promo" });
    }
    const productIds = promo.productIds;
    const products = await ProductModel.find({
      productId: { $in: productIds },
    }).lean();
    const newTimeLine = {
      date: new Date(),
      description: `Promo ${promo.title}/${promo.promoId} set to live with discount ${promo.discount.fixedPercentage}%`,
      actionBy: authUser._id,
    };
    const promises = products.map(async (product) => {
      const productDiscountedPercentage = product.promo.discountPercentage;
      const variations = product.variations.map((variation) => {
        const discount =
          variation.price -
          (variation.price * productDiscountedPercentage) / 100;
        return { ...variation, discount };
      });
      await ProductModel.findOneAndUpdate(
        {
          productId: product.productId,
        },
        {
          variations,
          promo: {
            promoId: promo.promoId,
            discountPercentage: productDiscountedPercentage,
            adminControlledDiscount: product.promo.adminControlledDiscount,
          },
          $push: { timeLine: newTimeLine },
        },
        { new: true }
      ).lean();
    });

    await Promise.all(promises);

    const updatedPromo = await PromoModel.findOneAndUpdate(
      {
        promoId,
      },
      { status: "live" },
      { new: true }
    ).lean();
    await deleteRedisKeysByPrefix(`$${ENV}:live_promos`); // deletes the cached live promos
    return res
      .status(200)
      .send({ data: updatedPromo, message: "Promo activated successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const expirePromo = async (req, res) => {
  try {
    const { promoId } = req.body;
    if (!promoId) {
      return res.status(400).send({ error: "promoId is required" });
    }
    const promo = await PromoModel.findOne({ promoId });
    if (!promo) {
      return res.status(400).send({ error: "Promo not found" });
    }
    if (promo.status !== "live") {
      return res.status(400).send({ error: "Promo is not in live status" });
    }
    if (promo.endDate > new Date()) {
      return res.status(400).send({ error: "Promo end date is not passed" });
    }

    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    if (!authUser?.isAdmin && !authUser?.superAdmin) {
      return res
        .status(400)
        .send({ error: "You are not authorized to expire promo" });
    }
    const productIds = promo.productIds;
    const products = await ProductModel.find({
      productId: { $in: productIds },
    }).lean();
    const newTimeLine = {
      date: new Date(),
      description: `Expired promo ${promo.title}/${promo.promoId}`,
      actionBy: authUser._id,
    };
    const promises = products.map(async (product) => {
      const variations = product.variations.map((variation) => {
        delete variation.discount;
        return { ...variation };
      });
      await ProductModel.findOneAndUpdate(
        {
          productId: product.productId,
        },
        { variations, promo: null, $push: { timeLine: newTimeLine } },
        { new: true }
      ).lean();
    });
    await Promise.all(promises);

    const updatedPromo = await PromoModel.findOneAndUpdate(
      {
        promoId,
      },
      { status: "expired" },
      { new: true }
    ).lean();
    await deleteRedisKeysByPrefix(`$${ENV}:live_promos`); // deletes the cached live promos
    return res
      .status(200)
      .send({ data: updatedPromo, message: "Promo deactivated successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const schedulePromo = async (req, res) => {
  try {
    const { promoId } = req.body;
    if (!promoId) {
      return res.status(400).send({ error: "promoId is required" });
    }
    const promo = await PromoModel.findOne({ promoId });
    if (!promo) {
      return res.status(400).send({ error: "Promo not found" });
    }
    if (promo.status !== "draft") {
      return res.status(400).send({ error: "Promo is not in draft status" });
    }
    const startDate = promo.startDate;
    const endDate = promo.endDate;
    if (startDate < new Date()) {
      return res.status(400).send({ error: "Promo start date is passed" });
    }
    if (endDate < new Date()) {
      return res.status(400).send({ error: "Promo end date is passed" });
    }
    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    if (!authUser?.isAdmin && !authUser?.superAdmin) {
      return res
        .status(400)
        .send({ error: "You are not authorized to schedule promo" });
    }
    const updatedPromo = await PromoModel.findOneAndUpdate(
      {
        promoId,
      },
      { status: "scheduled" },
      { new: true }
    ).lean();
    return res
      .status(200)
      .send({ data: updatedPromo, message: "Promo scheduled successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

module.exports = {
  createPromo,
  getPromos,
  getPromo,
  getProductPromo,
  getPromoWithProducts,
  getAvailablePromos,
  getLivePromos,
  getFinishedPromos,
  getDraftPromos,
  getScheduledPromos,
  updatePromo,
  deletePromo,
  joinPromo,
  leavePromo,
  updatePromoImage,
  activatePromo,
  expirePromo,
  schedulePromo,
};
