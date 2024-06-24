const ShopModel = require("../models/shop");
const UserModel = require("../models/user");
const { verifyUserId, verifyShopId } = require("../helpers/utils");

function getRandomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const generateUniqueShopId = async () => {
  let shopId;
  let found = true;

  do {
    const randomVal = getRandomInt(10000, 99999);
    shopId = `${randomVal}`;
    const exist = await ShopModel.findOne(
      {
        shopId,
      },
      { lean: true }
    );

    if (exist) {
      found = true;
    } else {
      found = false;
    }
  } while (found);

  return shopId.toString();
};

const createShop = async (req, res) => {
  try {
    const { userId, shopName } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    const user = await verifyUserId(userId);

    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }
    if (user.shopEnabled && user.shopId) {
      return res.status(400).json({ error: "User already has a shop" });
    }
    const shopExist = await ShopModel.findOne({
      shopName,
    });
    if (shopExist) {
      return res.status(400).json({ error: "Shop name already exist" });
    }
    const shopId = await generateUniqueShopId();
    const shop = new ShopModel({
      shopId,
      ...req.body,
      user: user._id,
    });
    await shop.save();
    if (!shop?._id) {
      return res.status(400).json({ error: "Shop not created" });
    }
    const updatedUser = await UserModel.findOneAndUpdate(
      {
        userId,
      },
      { shopId, shopEnabled: true },
      { new: true }
    ).lean();
    if (!updatedUser) {
      return res
        .status(400)
        .json({ error: "Shop created but User not updated" });
    }
    return res
      .status(200)
      .json({ data: shop, message: "Shop created successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getShops = async (req, res) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || "desc";
    const search = req.query.search || "";
    const match = {
      ...req.query,
      disabled: req.query.disabled ? req.query.disabled : false,
    };
    if (search) {
      match.$or = [
        { shopName: { $regex: search, $options: "i" } },
        { country: { $regex: search, $options: "i" } },
      ];
    }
    const query = { ...match };
    const shops = await ShopModel.find(query)
      .populate("user")
      .sort({ createdAt: sort })
      .skip(skip)
      .limit(limit)
      .lean();
    return res.status(200).json({ data: shops });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
const getShop = async (req, res) => {
  try {
    const { shopId } = req.query;
    const shop = await ShopModel.findOne({
      shopId,
    }).populate("user");
    if (!shop) {
      return res.status(400).json({ error: "Shop not found" });
    }
    return res.status(200).json({ data: shop });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateShop = async (req, res) => {
  try {
    const { shopId } = req.body;
    const shop = await ShopModel.findOne({
      shopId,
    });
    if (!shop) {
      return res.status(400).json({ error: "Shop not found" });
    }
    const updatedShop = await ShopModel.findOneAndUpdate(
      {
        shopId,
      },
      { ...req.body },
      { new: true }
    ).lean();

    return res.status(200).json({ data: updatedShop });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const absoluteDeleteShop = async (req, res) => {
  try {
    const { shopId } = req.body;
    if (!shopId) {
      return res.status(400).json({ error: "shopId is required" });
    }
    const shop = await ShopModel.findOne({
      shopId,
    });
    if (!shop) {
      return res.status(400).json({ error: "Shop not found" });
    }
    await ShopModel.findOneAndDelete({
      shopId,
    });
    const user = await UserModel.findOneAndUpdate(
      {
        shopId,
      },
      { shopId: "", shopEnabled: false },
      { new: true }
    ).lean();
    return res.status(200).json({ message: "Shop deleted successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
const deleteShop = async (req, res) => {
  try {
    const { shopId } = req.body;
    if (!shopId) {
      return res.status(400).json({ error: "shopId is required" });
    }
    const shop = await ShopModel.findOne({
      shopId,
    });
    if (!shop) {
      return res.status(400).json({ error: "Shop not found" });
    }
    await ShopModel.findOneAndUpdate(
      {
        shopId,
      },
      { disabled: true },
      { new: true }
    );
    const user = await UserModel.findOneAndUpdate(
      {
        shopId,
      },
      { shopEnabled: false },
      { new: true }
    ).lean();
    return res.status(200).json({ message: "Shop disabled successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
const restoreShop = async (req, res) => {
  try {
    const { shopId } = req.body;
    if (!shopId) {
      return res.status(400).json({ error: "shopId is required" });
    }
    const shop = await ShopModel.findOne({
      shopId,
    });
    if (!shop) {
      return res.status(400).json({ error: "Shop not found" });
    }
    await ShopModel.findOneAndUpdate(
      {
        shopId,
      },
      { disabled: false },
      { new: true }
    );
    const user = await UserModel.findOneAndUpdate(
      {
        shopId,
      },
      { shopEnabled: true },
      { new: true }
    ).lean();
    return res.status(200).json({ message: "Shop restored successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createShop,
  getShops,
  getShop,
  updateShop,
  deleteShop,
  restoreShop,
  absoluteDeleteShop,
};
