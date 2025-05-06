
const { getAuthUser } = require("../middleware/firebaseUserAuth");
const OrderModel = require("../models/order");
const ProductOrderModel = require("../models/productOrder");
const ProductModel = require("../models/products");
const ReviewModel = require("../models/review");
const ShopModel = require("../models/shop");
const { notifyShop } = require("./notification");


const canUserReview = async (user, product_id) => {
  const result = {
    canReview: true,
    isadmin: user?.isAdmin || user?.isSuperAdmin,
    orderId: null,
  };
  if (result.isadmin) {
    return result;
  }
  const review = await ReviewModel.findOne({
    user: user._id,
    product: product_id,
  }).exec();
  if (review) {
    result.canReview = false;
    result.denyReason = "You have already reviewed this product";
    return result;
  }
  const orders = await OrderModel.find({
    user: user._id,
    status: "delivered",
  })
    .populate("productOrders")
    .lean();
  const foundOrder = orders.find((order) =>
    order.productOrders.some(
      (productOrder) =>
        productOrder.product.toString() === product_id.toString()
    )
  );

  if (!foundOrder) {
    result.canReview = false;
    result.denyReason =
      "You can only review products that you have purchased and received";
    return result;
  }
  result.orderId = foundOrder.orderId;
  return result;
};
const getUserCanReview = async (req, res) => {
  try {
    const { productId } = req.query;
    if (!productId) {
      return res.status(400).send({ error: "productId is required" });
    }
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(200).send({ message: "User not found", data: {} });
    }
    const product = await ProductModel.findOne({ productId }).lean();
    if (!product) {
      return res.status(400).send({ error: "Product not found" });
    }
    const canReview = await canUserReview(user, product._id);

    return res.status(200).send({
      data: canReview,
      message: canReview.canReview
        ? "You can review this product"
        : `You cannot review this product because ${canReview.denyReason}`,
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const createReview = async (req, res) => {
  try {
    const {
      productId,
      rating,
      title,
      review,
      displayName,
      imageMatch,
      orderId,
    } = req.body;
    if (!productId) {
      return res.status(400).send({ error: "productId is required" });
    }
    if (!displayName) {
      return res.status(400).send({ error: "displayName is required" });
    }
    if (!imageMatch && imageMatch !== false) {
      return res.status(400).send({ error: "imageMatch is required" });
    }
    if (!rating) {
      return res.status(400).send({ error: "rating is required" });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).send({ error: "rating must be between 1 and 5" });
    }
    if (!title) {
      return res.status(400).send({ error: "title is required" });
    }
    if (!review) {
      return res.status(400).send({ error: "review is required" });
    }

    const user = await getAuthUser(req);
    if (!user) {
      return res.status(200).send({ message: "User not found", data: {} });
    }
    if (!orderId && !user.isAdmin && !user.isSuperAdmin) {
      return res.status(400).send({ error: "orderId is required" });
    }
    const product = await ProductModel.findOne({ productId }).exec();
    if (!product) {
      return res.status(400).send({ error: "Product not found" });
    }
    let order = null;
    let images = [];
    let deliveryDate = null;
    if (orderId) {
      order = await OrderModel.findOne({ orderId })
        .populate("productOrders")
        .exec();
      if (!order) {
        return res.status(400).send({ error: "Order not found" });
      }
      const productOrder = order.productOrders.find(
        (productOrder) =>
          productOrder.product.toString() === product._id.toString()
      );
      if (!productOrder) {
        return res.status(400).send({ error: "Product not found in order" });
      }
      images = productOrder.images;
      deliveryDate = productOrder.deliveryDate;
    }

    const canReview = await canUserReview(user, product._id);
    if (!canReview.canReview) {
      return res.status(400).send({
        error:
          "You cannot review this product as neither admin nor pourchased and received the product",
      });
    }

    const shop = await ShopModel.findOne({ shopId: product.shopId }).exec();
    if (!shop) {
      return res.status(400).send({ error: "This product has no shop" });
    }

    if (shop?.user.toString() === user._id.toString()) {
      return res
        .status(400)
        .send({ error: "You cannot review your own product" });
    }

    const reviewData = {
      product: product._id,
      productId,
      orderId,
      user: user._id,
      rating,
      title,
      review,
      displayName,
      imageMatch,
      images,
      deliveryDate,
    };
    const reviewInstance = new ReviewModel(reviewData);
    await reviewInstance.save();
    const shop_id = shop._id.toString();
    if (shop_id) {
      const title = "New Review";
      const body = `A new review has been added to your product - ${product.title}`;
      const image = product?.colors[0]?.images[0]?.link;
      const notifyShopParam = { shop_id, title, body, image };
      const notify = await notifyShop(notifyShopParam);
    }
    res
      .status(201)
      .send({ data: reviewInstance, message: "Review created successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const calcAvrerageRating = (reviews) => {
  const totalRating = reviews.reduce((acc, review) => acc + review.rating, 0);
  return totalRating / reviews.length;
};

const getReviews = async (req, res) => {
  try {
    const { productId } = req.query;
    if (!productId) {
      return res.status(400).send({ error: "productId is required" });
    }

    const reviews = await ReviewModel.find({ productId, ...req.query })
      .populate("user")
      .exec();
    const averageRating = calcAvrerageRating(reviews);
    let imageMatch = {
      true: 0,
      false: 0,
    };
    reviews.forEach((review) => {
      imageMatch[review.imageMatch] += 1;
    });
    imageMatch = {
      ...imageMatch,
      total: reviews.length,
    };

    res.status(200).send({
      data: {
        reviews,
        averageRating,
        imageMatch,
      },
      message: "Reviews retrieved successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const getAuthUserReviews = async (req, res) => {
  try {
   
    const user = await getAuthUser(req);
    const reviews = await ReviewModel.find({ user: user._id })
      .populate("product", "productId title")
      .lean();

    const product_ids = reviews.map((review) => review?.product._id) || [];

    // const orderWithoutReviewQuery = {
    //   user: user._id,
    //   status: "delivered",
    // };
    // if (product_ids.length > 0) {
    //   orderWithoutReviewQuery.product = { $nin: product_ids };
    // }
    const ordersWithoutReview =
      (await ProductOrderModel.find({
        user: user._id.toString(),
        product: { $nin: product_ids },
        "status.value": "order delivered",
      })
        .populate("product", "productId title")
        .lean()) || [];

    const pendingReviews = ordersWithoutReview.map((order) => {
      return {
        order: {
          productId: order.product.productId,
          title: order.product.title,
          images: order.images,
          orderId: order.orderId,
          color: order.color,
          size: order.size,
          sku: order.sku,
          quantity: order.quantity,
          deliveryDate: order.deliveryDate,
        },
        rating: null,
      };
    });
    const givenReviews = await Promise.all(
      reviews.map(async (review) => {
        const product = review.product;
        const order = await ProductOrderModel.findOne({
          user: user._id.toString(),
          product: product._id,
          orderId: review.orderId,
        }).lean();
        return {
          ...review,
          order: {
            productId: product.productId,
            title: product.title,
            color: order.color,
            size: order?.size,
            sku: order?.sku,
            quantity: order?.quantity,
            deliveryDate: order?.deliveryDate,
            images: order?.images,
          },
        };
      })
    );
    const data = {
      givenReviews,
      pendingReviews,
    };
    res.status(200).send({
      data,
      message: "Reviews retrieved successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const getReview = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) {
      return res.status(400).send({ error: "_id is required" });
    }
    const review = await ReviewModel.findOne({ _id: _id })
      .populate("user")
      .exec();
    if (!review) {
      return res.status(400).send({ error: "Review not found" });
    }

    res
      .status(200)
      .send({ data: review, message: "Review retrieved successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const updateReview = async (req, res) => {
  try {
    const {
      review_id,
      productId,
      rating,
      title,
      review,
      displayName,
      imageMatch,
    } = req.body;
    if (!review_id) {
      return res.status(400).send({ error: "review_id is required" });
    }
    if (!productId) {
      return res.status(400).send({ error: "productId is required" });
    }
    if (!displayName) {
      return res.status(400).send({ error: "displayName is required" });
    }
    if (!imageMatch) {
      return res.status(400).send({ error: "imageMatch is required" });
    }
    if (!rating) {
      return res.status(400).send({ error: "rating is required" });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).send({ error: "rating must be between 1 and 5" });
    }
    if (!title) {
      return res.status(400).send({ error: "title is required" });
    }
    if (!review) {
      return res.status(400).send({ error: "review is required" });
    }
    const product = await ProductModel.findOne({ productId }).exec();
    if (!product) {
      return res.status(400).send({ error: "Product not found" });
    }

    const currentReview = await ReviewModel.findOne({ _id: review_id }).exec();
    if (!currentReview) {
      return res.status(400).send({ error: "Review not found" });
    }
    const user = await getAuthUser(req);
    if (currentReview.user.toString() !== user._id.toString()) {
      return res
        .status(400)
        .send({ error: "You are not authorized to update this review" });
    }
    const updatedReview = await ReviewModel.findOneAndUpdate(
      {
        _id: review_id,
      },
      { ...req.body },
      { new: true }
    ).lean();
    res
      .status(200)
      .send({ data: updatedReview, message: "Review updated successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const deleteReview = async (req, res) => {
  try {
    const { _id } = req.body;
    if (!_id) {
      return res.status(400).send({ error: "_id is required" });
    }
    const review = await ReviewModel.findOne({ _id: _id }).exec();
    if (!review) {
      return res.status(400).send({ error: "Review not found" });
    }
    const user = await getAuthUser(req);
    if (review.user.toString() !== user._id.toString()) {
      return res
        .status(400)
        .send({ error: "You are not authorized to delete this review" });
    }
    await ReviewModel.deleteOne({ _id: _id }).exec();
    res.status(200).send({ message: "Review deleted successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const getReviewsForShopProducts = async (req, res) => {
  try {
    const shop = await ShopModel.findOne({ shopId: req.query.shopId }).exec();
    if (!shop) {
      return res.status(400).send({ error: "Shop not found" });
    }
    const products = await ProductModel.find({ shopId: shop.shopId }).exec();
    const productIds = products.map((product) => product.productId);
    const reviews = await ReviewModel.find({
      productId: {
        $in: productIds,
      },
    })
      .populate("user")
      .exec();

    const reviewsData = products.map((product) => {
      const productReviews = reviews.filter(
        (review) => review.productId === product.productId
      );
      return {
        product,
        reviews: productReviews,
      };
    });
    const averageRating = calcAvrerageRating(reviews);

    res.status(200).send({
      data: {
        reviews: reviewsData,
        averageRating,
      },
      message: "Reviews retrieved successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const likeReview = async (req, res) => {
  try {
    const { _id } = req.body;
    if (!_id) {
      return res.status(400).send({ error: "_id is required" });
    }
    const review = await ReviewModel.findOne({ _id: _id }).exec();
    if (!review) {
      return res.status(400).send({ error: "Review not found" });
    }
    const user = await getAuthUser(req);
    if (review.user.toString() === user._id.toString()) {
      return res.status(400).send({ error: "You cannot like your own review" });
    }
    if (review.likes.users.includes(user._id)) {
      return res
        .status(400)
        .send({ error: "You have already liked this review" });
    }
    // has user disliked review
    if (review.dislikes.users.includes(user._id)) {
      review.dislikes.users = review.dislikes.users.filter(
        (userId) => userId.toString() !== user._id.toString()
      );
      review.dislikes.value -= 1;
    }
    review.likes.users.push(user._id);
    review.likes.value += 1;
    await review.save();
    res
      .status(200)
      .send({ data: review, message: "Review liked successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const dislikeReview = async (req, res) => {
  try {
    const { _id } = req.body;
    if (!_id) {
      return res.status(400).send({ error: "_id is required" });
    }
    const review = await ReviewModel.findOne({ _id: _id }).exec();
    if (!review) {
      return res.status(400).send({ error: "Review not found" });
    }
    const user = await getAuthUser(req);
    if (review.user.toString() === user._id.toString()) {
      return res
        .status(400)
        .send({ error: "You cannot dislike your own review" });
    }
    if (review.dislikes.users.includes(user._id)) {
      return res
        .status(400)
        .send({ error: "You have already disliked this review" });
    }
    // has user liked review
    if (review.likes.users.includes(user._id)) {
      review.likes.users = review.likes.users.filter(
        (userId) => userId.toString() !== user._id.toString()
      );
      review.likes.value -= 1;
    }
    review.dislikes.users.push(user._id);
    review.dislikes.value += 1;
    await review.save();
    res
      .status(200)
      .send({ data: review, message: "Review disliked successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

module.exports = {
  createReview,
  getReviews,
  getReview,
  updateReview,
  deleteReview,
  getReviewsForShopProducts,
  likeReview,
  dislikeReview,
  getAuthUserReviews,
  getUserCanReview,
};
