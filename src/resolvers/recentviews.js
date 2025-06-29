const { getAuthUser } = require("../middleware/firebaseUserAuth");
const RecentViewsModel = require("../models/recentViews");

const addRecentView = async (product_id, user_id) => {
  const recentView = await RecentViewsModel.findOne({ user: user_id });
  if (recentView) {
    const products = recentView.products || [];
    const uniqueProducts = products.filter(
      (product) => product.toString() !== product_id.toString()
    );
    uniqueProducts.push(product_id);
    // limit the number of products to 50
    const limitedProducts = uniqueProducts.slice(-50);
    recentView.products = limitedProducts;
    await recentView.save();
    return recentView;
  } else {
    const newRecentView = new RecentViewsModel({
      user: user_id,
      products: [product_id],
    });
    await newRecentView.save();
    return newRecentView;
  }
};

const getAuthRecentViews = async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res.status(401).send({ error: "Unauthorized" });
    }
    let products = [];
    const recentViews = await RecentViewsModel.findOne({
      user: authUser._id,
    })
      // populate the product inside products array
      .populate("products")
      .lean();

    if (recentViews) {
      products = recentViews.products
        .filter((product) => product.status === "live")
        .reverse();
    }
    res.status(200).send({ data: products });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
module.exports = {
  getAuthRecentViews,
  addRecentView,
};
