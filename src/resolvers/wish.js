const { getAuthUser } = require("../middleware/firebaseUserAuth");
const ProductModel = require("../models/products");
const WishModel = require("../models/wish");

const addWish = async (req, res) => {
  try {
    const { productId, color } = req.body;

    if (!productId) {
      return res.status(400).send({ error: "required  productId" });
    }
    if (!color) {
      return res.status(400).send({ error: "required selected color" });
    }
    const product = await ProductModel.findOne({ productId });
    if (!product) {
      return res.status(400).send({ error: "Product not found" });
    }
    const productColors = product.colors.map((color) => color.value);
    if (!productColors.includes(color)) {
      return res.status(400).send({ error: "Color not found in the product" });
    }
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    const user_id = authUser._id;

    const wish = await WishModel.findOne({
      user: user_id,
      product: product._id,
      color,
    });

    if (wish) {
      return res.status(400).send({ error: "Wish already added" });
    }

    const newWish = new WishModel({
      user: user_id,
      product: product._id,
      color,
    });
    await newWish.save();
    return res
      .status(200)
      .send({ message: "Product added to wish list successfully", data: newWish });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const removeWish = async (req, res) => {
  try {
    const { wish_id } = req.body;
    if (!wish_id) {
      return res.status(400).send({ error: "required wish_id" });
    }
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    const user_id = authUser._id;
    const wish = await WishModel.findOne({
      _id: wish_id,
      user: user_id,
    });
    if (!wish) {
      return res.status(400).send({ error: "Wish not found" });
    }
    await wish.remove();
    return res.status(200).send({ message: "Wish removed successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const getAuthUserWishes = async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    const user_id = authUser._id;
    const wishes = await WishModel.find({
      user: user_id,
    }).populate("product");
    // add the applied image from product to the wish
    wishes.forEach((wish) => {
      const product = wish.product;
      const color = wish.color;
      const appliedColor = product.colors.find((c) => c.value === color);
      if (appliedColor) {
        wish.image = appliedColor.images.find((img) => img.link).link;
      } else {
        wish.image = product.images.find((img) => img.link).link;
      }
    });

    return res.status(200).send({
      data: wishes,
      message: "Wishes fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const getUserWishes = async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).send({ error: "required user_id" });
    }
    const wishes = await WishModel.find({
      user: user_id,
    }).populate("product");
    return res.status(200).send({
      data: wishes,
      message: "Wishes fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

module.exports = {
  addWish,
  removeWish,
  getAuthUserWishes,
  getUserWishes,
};
