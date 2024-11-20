const { getAuthUser } = require("../middleware/firebaseUserAuth");
const ProductModel = require("../models/products");
const ReviewModel = require("../models/review");
const ShopModel = require("../models/shop");

const createReview = async (req, res) => {
  try {
    const { productId, rating, title, review, displayName, imageMatch } =
      req.body;
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
    const product = await ProductModel.findOne({ productId }).exec();
    if (!product) {
      return res.status(400).send({ error: "Product not found" });
    }
    const user = await getAuthUser(req);
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
      productId,
      user: user._id,
      rating,
      title,
      review,
      displayName,
      imageMatch,
    };
    const reviewInstance = new ReviewModel(reviewData);
    await reviewInstance.save();
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

    res.status(200).send({
      data: {
        reviews,
        averageRating,
      },
      message: "Reviews retrieved successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const getReview = async (req, res) => {
  try {
    const { reviewId } = req.query;
    if (!reviewId) {
      return res.status(400).send({ error: "reviewId is required" });
    }
    const review = await ReviewModel.findOne({ _id: reviewId })
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
      reviewId,
      productId,
      rating,
      title,
      review,
      displayName,
      imageMatch,
    } = req.body;
    if (!reviewId) {
      return res.status(400).send({ error: "reviewId is required" });
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

    const currentReview = await ReviewModel.findOne({ _id: reviewId }).exec();
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
        _id: reviewId,
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
    const { reviewId } = req.body;
    if (!reviewId) {
      return res.status(400).send({ error: "reviewId is required" });
    }
    const review = await ReviewModel.findOne({ _id: reviewId }).exec();
    if (!review) {
      return res.status(400).send({ error: "Review not found" });
    }
    const user = await getAuthUser(req);
    if (review.user.toString() !== user._id.toString()) {
      return res
        .status(400)
        .send({ error: "You are not authorized to delete this review" });
    }
    await ReviewModel.deleteOne({ _id: reviewId }).exec();
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
    const { reviewId } = req.body;
    if (!reviewId) {
      return res.status(400).send({ error: "reviewId is required" });
    }
    const review = await ReviewModel.findOne({ _id: reviewId }).exec();
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
    const { reviewId } = req.body;
    if (!reviewId) {
      return res.status(400).send({ error: "reviewId is required" });
    }
    const review = await ReviewModel.findOne({ _id: reviewId }).exec();
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
};
