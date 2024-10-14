const { getAuthUser } = require("../middleware/firebaseUserAuth");
const CommentModel = require("../models/comment");

const createComment = async (req, res) => {
    try {
      const { type, comment, userId } = req.body;
      if (!type) {
        return res.status(400).json({ error: "required comment type" });
      }
        if (!comment) {
            return res.status(400).json({ error: "required comment" });
        }
        if (!userId && type ==="user") {
            return res.status(400).json({ error: "required userId in user comment type" });
        }
        const authUser = await getAuthUser(req);

    if (!authUser) {
      return res.status(400).json({ error: "User not found" });
    }
    if(!authUser.isAdmin && !authUser.isSuperAdmin){
        return res.status(400).json({ error: "You are not authorized to create comment" });
        }
    const  commentBy = authUser._id;
    const commentData = new CommentModel({
      commentBy,
      ...req.body,
    });
    const commentRes = await commentData.save();
    if (!commentRes?._id) {
      return res.status(400).json({ error: "Comment not created" });
    }
    return res.status(200).json({ message: "Comment created successfully" });
  
     
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  };

  const getUserComments = async (req, res) => {
    try {
      const { userId } = req.query
    
        if (!userId) {
            return res.status(400).json({ error: "required userId" });
        }
        const comments = await CommentModel.find({ userId }).populate("commentBy");
        return res.status(200).json({ data:comments, message: "Comments fetched successfully" });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  const deleteComment = async (req, res) => {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: "required _id" });
      }
      const authUser = await getAuthUser(req);
      if (!authUser) {
          return res.status(400).json({ error: "User not found" });
          }
          const oldComment = await CommentModel.findById(_id).lean();
          if(String(authUser._id) !== String( oldComment.commentBy) ){
           
          
              return res.status(400).json({ error: "You are not authorized to edit comment" });
              }
      const comment = await CommentModel.findByIdAndDelete(_id);
      if (!comment) {
        return res.status(400).json({ error: "Comment not found" });
      }

        
      return res.status(200).json({ message: "Comment deleted successfully" });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  const updateComment = async (req, res) => {
    try {
      const { _id, comment } = req.body;
      if (!_id) {
        return res.status(400).json({ error: "required _id" });
      }
      if (!comment) {
        return res.status(400).json({ error: "required comment" });
      }
      const authUser = await getAuthUser(req);
      if (!authUser) {
          return res.status(400).json({ error: "User not found" });
          }
          const oldComment = await CommentModel.findById(_id).lean();
          if(String(authUser._id) !== String( oldComment.commentBy) ){
           
          
              return res.status(400).json({ error: "You are not authorized to edit comment" });
              }
      const commentRes = await CommentModel.findByIdAndUpdate(_id, { comment });
      if (!commentRes) {
        return res.status(400).json({ error: "Comment not found" });
      }
      return res.status(200).json({ message: "Comment updated successfully" });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }



  module.exports = {
    createComment,
    getUserComments,
    deleteComment,
    updateComment
  }