const {
  helpCenterCategoryEnums,
  helpCenterSubCategoryEnums,
} = require("../helpers/constants");
const { getAuthUser } = require("../middleware/firebaseUserAuth");
const HelpArticleModel = require("../models/helpArticles");

function getRandomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const generateUniqueArticleId = async () => {
  let articleId;
  let found = true;

  do {
    const randomVal = getRandomInt(1000000, 9999999);
    articleId = `${randomVal}`;
    const exist = await HelpArticleModel.findOne(
      {
        articleId,
      },
      { lean: true }
    );

    if (exist) {
      found = true;
    } else {
      found = false;
    }
  } while (found);

  return articleId.toString();
};

const addArticle = async (req, res) => {
  try {
    const { title, content, tags, category, subCategory } = req.body;
    if (!title) {
      throw new Error("Title is required");
    }
    if (!content) {
      throw new Error("Content is required");
    }
    if (!category) {
      throw new Error("Category is required");
    }
    if (!subCategory) {
      throw new Error("Subcategory is required");
    }
    if (!helpCenterCategoryEnums.includes(category)) {
      throw new Error("Invalid category");
    }
    if (!helpCenterSubCategoryEnums.includes(subCategory)) {
      throw new Error("Invalid subcategory");
    }
    if (tags && !Array.isArray(tags)) {
      throw new Error("Tags must be an array");
    }
    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    if (!authUser?.isAdmin && !authUser?.superAdmin) {
      return res
        .status(400)
        .send({ error: "You are not authorized to add help articles" });
    }
    const articleId = await generateUniqueArticleId();
    if (!articleId) {
      return res.status(500).send({ error: "Failed to generate article ID" });
    }
    const newArticle = new HelpArticleModel({
      title,
      articleId,
      content,
      tags: tags || [],
      category,
      subCategory,
      createdBy: authUser._id,
    });
    const savedArticle = await newArticle.save();
    res
      .status(201)
      .send({ data: savedArticle, message: "Help article added successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const getArticles = async (req, res) => {
  try {
    const { category, subCategory } = req.query;

    const filter = {};
    if (category) {
      if (!helpCenterCategoryEnums.includes(category)) {
        throw new Error("Invalid category");
      }
      filter.category = category;
    }
    if (subCategory) {
      if (!helpCenterSubCategoryEnums.includes(subCategory)) {
        throw new Error("Invalid subcategory");
      }
      filter.subCategory = subCategory;
    }
    const articles = await HelpArticleModel.find(filter)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).send({ data: articles });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const deleteArticle = async (req, res) => {
  try {
    const { articleId } = req.body;
    if (!articleId) {
      throw new Error("Article ID is required");
    }
    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    if (!authUser?.isAdmin && !authUser?.superAdmin) {
      return res
        .status(400)
        .send({ error: "You are not authorized to delete help articles" });
    }
    const deletedArticle = await HelpArticleModel.findOneAndDelete({
      articleId,
    });
    if (!deletedArticle) {
      return res.status(404).send({ error: "Article not found" });
    }
    res.status(200).send({ message: "Help article deleted successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const updateArticle = async (req, res) => {
  try {
    const { articleId, title, content, tags, category, subCategory } = req.body;

    if (!articleId) {
      throw new Error("Article ID is required");
    }
    if (!title) {
      throw new Error("Title is required");
    }
    if (!content) {
      throw new Error("Content is required");
    }
    if (!category) {
      throw new Error("Category is required");
    }
    if (!subCategory) {
      throw new Error("Subcategory is required");
    }
    if (!helpCenterCategoryEnums.includes(category)) {
      throw new Error("Invalid category");
    }
    if (!helpCenterSubCategoryEnums.includes(subCategory)) {
      throw new Error("Invalid subcategory");
    }
    if (tags && !Array.isArray(tags)) {
      throw new Error("Tags must be an array");
    }
    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    if (!authUser?.isAdmin && !authUser?.superAdmin) {
      return res
        .status(400)
        .send({ error: "You are not authorized to update help articles" });
    }
    const updatedArticle = await HelpArticleModel.findOneAndUpdate(
      { articleId },
      { title, content, tags: tags || [], category, subCategory },
      { new: true }
    );
    if (!updatedArticle) {
      return res.status(404).send({ error: "Article not found" });
    }

    res.status(200).send({
      data: updatedArticle,
      message: "Help article updated successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const getArticle = async (req, res) => {
  try {
    const { articleId } = req.query;
    if (!articleId) {
      throw new Error("Article ID is required");
    }

    const article = await HelpArticleModel.findOne({ articleId })
      .populate("createdBy", "name email")
      .lean();
    if (!article) {
      return res.status(404).send({ error: "Article not found" });
    }
    if (article) {
      const authUser = req?.cachedUser || (await getAuthUser(req));
      // check if user marked this article as helpful or not helpful
      if (authUser) {
        article.markedIsHelpful = article.helpfulCount.find((userId) =>
          userId.equals(authUser._id)
        )
          ? true
          : false;
        article.markedIsNotHelpful = article.notHelpfulCount.find((userId) =>
          userId.equals(authUser._id)
        )
          ? true
          : false;
      }
    }
    res.status(200).send({ data: article });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const addToPopularTopics = async (req, res) => {
  // only max of 6 articles per category
  try {
    const { articleId } = req.body;
    if (!articleId) {
      return res.status(400).send({ error: "Article ID is required" });
    }
    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    if (!authUser?.isAdmin && !authUser?.superAdmin) {
      return res
        .status(400)
        .send({ error: "You are not authorized to add to popular topics" });
    }
    const article = await HelpArticleModel.findOne({ articleId });
    if (!article) {
      return res.status(404).send({ error: "Article not found" });
    }
    if (article.isPopular) {
      return res.status(400).send({ error: "Article is already popular" });
    }
    // Check if there are already 6 popular articles in the same category
    const popularArticlesCount = await HelpArticleModel.countDocuments({
      category: article.category,
      isPopular: true,
    });
    if (popularArticlesCount >= 6) {
      return res.status(400).send({
        error:
          "Maximum of 6 popular articles per category reached. Please remove one before adding a new one.",
      });
    }
    // Update the article to set it as popular
    article.isPopular = true;
    const updatedArticle = await article.save();
    res.status(200).send({
      data: updatedArticle,
      message: "Article added to popular topics successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const removeFromPopularTopics = async (req, res) => {
  try {
    const { articleId } = req.body;
    if (!articleId) {
      return res.status(400).send({ error: "Article ID is required" });
    }
    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    if (!authUser?.isAdmin && !authUser?.superAdmin) {
      return res.status(400).send({
        error: "You are not authorized to remove from popular topics",
      });
    }
    const article = await HelpArticleModel.findOne({ articleId });
    if (!article) {
      return res.status(404).send({ error: "Article not found" });
    }
    if (!article.isPopular) {
      return res.status(400).send({ error: "Article is not popular" });
    }
    // Update the article to remove it from popular
    article.isPopular = false;
    const updatedArticle = await article.save();
    res.status(200).send({
      data: updatedArticle,
      message: "Article removed from popular topics successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const getPopularTopicsByCategory = async (req, res) => {
  try {
    const { category } = req.query;
    if (!category) {
      return res.status(400).send({ error: "Category is required" });
    }
    if (!helpCenterCategoryEnums.includes(category)) {
      return res.status(400).send({ error: "Invalid category" });
    }
    const popularArticles = await HelpArticleModel.find({
      category,
      isPopular: true,
    })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .limit(6); // Limit to 6 popular articles per category

    res.status(200).send({ data: popularArticles });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const markHelpful = async (req, res) => {
  try {
    const { articleId, isHelpful } = req.body;
    if (!articleId) {
      return res.status(400).send({ error: "Article ID is required" });
    }
    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    const article = await HelpArticleModel.findOne({ articleId });
    if (!article) {
      return res.status(404).send({ error: "Article not found" });
    }
    if (isHelpful === undefined) {
      return res.status(400).send({ error: "isHelpful is required" });
    }
    if (isHelpful !== "yes" && isHelpful !== "no") {
      return res
        .status(400)
        .send({ error: "isHelpful must be either yes or no" });
    }
    // Check if the user has already marked this article as helpful or not helpful
    if (isHelpful === "yes") {
      if (article.helpfulCount.includes(authUser._id)) {
        return res.status(200).send({ message: "Already marked as helpful" });
      }
      // Remove from notHelpfulCount if exists
      article.notHelpfulCount = article.notHelpfulCount.filter(
        (userId) => !userId.equals(authUser._id)
      );
      article.helpfulCount.push(authUser._id);
    } else {
      if (article.notHelpfulCount.includes(authUser._id)) {
        return res
          .status(200)
          .send({ message: "Already marked as not helpful" });
      }
      // Remove from helpfulCount if exists
      article.helpfulCount = article.helpfulCount.filter(
        (userId) => !userId.equals(authUser._id)
      );
      article.notHelpfulCount.push(authUser._id);
    }
    // Save the article
    await article.save();
    res.status(200).send({ message: "Marked as helpful successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

module.exports = {
  addArticle,
  getArticles,
  getArticle,
  getPopularTopicsByCategory,
  deleteArticle,
  updateArticle,
  addToPopularTopics,
  removeFromPopularTopics,
  markHelpful,
};
