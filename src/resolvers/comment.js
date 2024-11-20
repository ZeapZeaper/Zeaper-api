const { getAuthUser } = require("../middleware/firebaseUserAuth");
const CommentModel = require("../models/comment");

const createComment = async (req, res) => {
  try {
    const { type, comment, userId } = req.body;
    if (!type) {
      return res.status(400).send({ error: "required comment type" });
    }
    if (!comment) {
      return res.status(400).send({ error: "required comment" });
    }
    if (!userId && type === "user") {
      return res
        .status(400)
        .send({ error: "required userId in user comment type" });
    }
    const authUser = await getAuthUser(req);

    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    if (!authUser.isAdmin && !authUser.isSuperAdmin) {
      return res
        .status(400)
        .send({ error: "You are not authorized to create comment" });
    }
    const commentBy = authUser._id;
    const commentData = new CommentModel({
      commentBy,
      ...req.body,
    });
    const commentRes = await commentData.save();
    if (!commentRes?._id) {
      return res.status(400).send({ error: "Comment not created" });
    }
    return res.status(200).send({ message: "Comment created successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const getUserComments = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).send({ error: "required userId" });
    }
    const comments = await CommentModel.find({ userId }).populate("commentBy");
    return res
      .status(200)
      .send({ data: comments, message: "Comments fetched successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const getShopComments = async (req, res) => {
  try {
    const { shopId } = req.query;

    if (!shopId) {
      return res.status(400).send({ error: "required shopId" });
    }
    const comments = await CommentModel.find({ shopId }).populate("commentBy");
    return res
      .status(200)
      .send({ data: comments, message: "Comments fetched successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const deleteComment = async (req, res) => {
  try {
    const { _id } = req.body;
    if (!_id) {
      return res.status(400).send({ error: "required _id" });
    }
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    const oldComment = await CommentModel.findById(_id).lean();
    if (!authUser.superAdmin) {
      return res
        .status(400)
        .send({ error: "You are not authorized to delete comment" });
    }
    const comment = await CommentModel.findByIdAndDelete(_id);
    if (!comment) {
      return res.status(400).send({ error: "Comment not found" });
    }

    return res.status(200).send({ message: "Comment deleted successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const updateComment = async (req, res) => {
  try {
    const { _id, comment } = req.body;
    if (!_id) {
      return res.status(400).send({ error: "required _id" });
    }
    if (!comment) {
      return res.status(400).send({ error: "required comment" });
    }
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    if (!authUser.superAdmin) {
      return res
        .status(400)
        .send({ error: "You are not authorized to update comment" });
    }
    const commentRes = await CommentModel.findByIdAndUpdate(_id, { comment });
    if (!commentRes) {
      return res.status(400).send({ error: "Comment not found" });
    }
    return res.status(200).send({ message: "Comment updated successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

module.exports = {
  createComment,
  getUserComments,
  getShopComments,
  deleteComment,
  updateComment,
};
