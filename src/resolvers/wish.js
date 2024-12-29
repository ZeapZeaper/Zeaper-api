const { getAuthUser } = require("../middleware/firebaseUserAuth");
const ProductModel = require("../models/products");
const WishModel = require("../models/wish");

const addWish = async (req, res) => {
  try {
    const { product_id } = req.body;

    if (!product_id) {
      return res.status(400).send({ error: "required  product_id" });
    }
    const product = await ProductModel.findOne({ _id: product_id });
    if (!product) {
      return res.status(400).send({ error: "Product not found" });
    }
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    const user_id = authUser._id;

    const wish = await WishModel.findOne({
      user: user_id,
      product: product_id,
    });

    if (wish) {
      return res.status(400).send({ error: "Wish already added" });
    }

    const newWish = new WishModel({
      user: user_id,
      product: product_id,
    });
    await newWish.save();
    return res
      .status(200)
      .send({ message: "Wish added successfully", data: newWish });
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
