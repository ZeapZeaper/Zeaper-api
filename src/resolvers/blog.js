const BlogPostModel = require("../models/blogPosts");
const { ObjectId } = require("mongodb");
const { getAuthUser } = require("../middleware/firebaseUserAuth");

const { storageRef } = require("../config/firebase"); // reference to our db
const root = require("../../root");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const { deleteLocalFile } = require("../helpers/utils");
const BlogCommentModel = require("../models/blogComments");
const UserModel = require("../models/user");
const { userCache } = require("../helpers/cache");

//saving image to firebase storage
const addImage = async (req, filename) => {
  let url = {};
  if (filename) {
    const source = path.join(root + "/uploads/" + filename);
    await sharp(source)
      .resize(1024, 1024)
      .jpeg({ quality: 100 })
      .toFile(path.resolve(req.file.destination, "resized", filename));
    const storage = await storageRef.upload(
      path.resolve(req.file.destination, "resized", filename),
      {
        public: true,
        destination: `/blog/${filename}`,
        metadata: {
          cacheControl: "public, max-age=31536000, immutable", // 1 year caching
          firebaseStorageDownloadTokens: uuidv4(),
        },
      }
    );
    url = {
      link: `https://storage.googleapis.com/${storageRef.name}/blog/${filename}`,
      name: filename,
    };
    const deleteSourceFile = await deleteLocalFile(source);
    const deleteResizedFile = await deleteLocalFile(
      path.resolve(req.file.destination, "resized", filename)
    );
    await Promise.all([deleteSourceFile, deleteResizedFile]);
    return url;
  }
  return url;
};

const deleteImageFromFirebase = async (name) => {
  if (name) {
    storageRef
      .file("/blog/" + name)
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

const generateUniqueBlogPostId = async () => {
  let blogPostId;
  let found = true;

  do {
    const randomVal = getRandomInt(1000000, 9999999);
    blogPostId = `${randomVal}`;
    const exist = await BlogPostModel.findOne(
      {
        blogPostId,
      },
      { lean: true }
    );

    if (exist) {
      found = true;
    } else {
      found = false;
    }
  } while (found);

  return blogPostId.toString();
};

const createBlogPost = async (req, res) => {
  let image = {};
  try {
    const { title, content } = req.body;
    if (!title) {
      return res.status(400).send({ error: "Title is required" });
    }
    if (!content) {
      return res.status(400).send({ error: "Content is required" });
    }
    let tags = req.body.tags;
    if (!tags) {
      tags = [];
    }
    // convert tags to an array if it's a string and trim whitespace and remove all special characters
    if (tags && typeof tags === "string") {
      tags = tags
        .split(",")
        .map((tag) => tag.trim().replace(/[^a-zA-Z0-9 ]/g, ""));
    }

    if (tags && !Array.isArray(tags)) {
      return res.status(400).send({ error: "Tags must be an array" });
    }

    if (!tags) {
      return res.status(400).send({ error: "Tags are required" });
    }

    if (tags && tags.length < 1) {
      return res.status(400).send({ error: "At least one tag is required" });
    }
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res.status(401).send({ error: "Unauthorized" });
    }
    const isAuthor = authUser && authUser.isBlogAuthor;
    if (!isAuthor) {
      return res
        .status(403)
        .send({ error: "Unauthorized to create blog posts" });
    }
    if (!req.file) {
      return res.status(400).send({ error: "no file uploaded" });
    }
    const filename = req.file.filename;
    image = await addImage(req, filename);
    const blogPostId = await generateUniqueBlogPostId();
    const blogPost = new BlogPostModel({
      title,
      content,
      tags,
      image,
      blogPostId,
      author: authUser._id,
    });
    await blogPost.save();
    res.status(201).send({
      message: "Blog post created successfully",
      blogPostId: blogPost.blogPostId,
    });
  } catch (error) {
    if (image && image.name) {
      await deleteImageFromFirebase(image.name);
    }
    res.status(400).send({ error: error.message });
  }
};

const getBlogPosts = async (req, res) => {
  try {
    const { status } = req.query;
    if (status && !["draft", "published", "archived"].includes(status)) {
      return res.status(400).send({ error: "Invalid status" });
    }

    const authUser = await getAuthUser(req);
    if (
      authUser &&
      !authUser.isBlogAuthor &&
      status &&
      status !== "published"
    ) {
      return res
        .status(403)
        .send({ error: "Unauthorized to view blog posts with this status" });
    }
    const filter = {};
    if (status) {
      filter.status = status;
    }
    // Fetch all blog posts with the specified status
    const blogPosts = await BlogPostModel.find(filter)
      .populate("author", "firstname lastName email social")
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).send({
      data: blogPosts,
      message: "Blog posts fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const getPublishedBlogPosts = async (req, res) => {
  try {
    const blogPosts = await BlogPostModel.find({
      status: "published",
      ...req.query, // Allow filtering by other query parameters
    })
      .populate("author", "firstname lastName email social")
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).send({
      data: blogPosts,
      message: "Blog posts fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const getSimilarPublisedBlogPosts = async (req, res) => {
  try {
    const { blogPostId } = req.query;
    if (!blogPostId) {
      return res.status(400).send({ error: "Blog post ID is required" });
    }
    // Fetch the blog post to get its tags
    const blogPost = await BlogPostModel.findOne({ blogPostId });
    if (!blogPost) {
      return res.status(404).send({ error: "Blog post not found" });
    }
    // Find similar published blog posts based on tags
    const similarPosts = await BlogPostModel.find({
      status: "published",
      tags: { $in: blogPost.tags },
      blogPostId: { $ne: blogPostId }, // Exclude the current blog post
    })
      .populate("author", "firstname lastName email social")
      .sort({ createdAt: -1 })
      .limit(5) // Limit to 5 similar posts
      .lean();

    res.status(200).send({
      data: similarPosts,
      message: "Similar published blog posts fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const getPublishedTags = async (req, res) => {
  try {
    // sort tags by most used
    // get distinct tags from published blog posts
    // and return them as an array
    // if no tags found, []
    const tags = await BlogPostModel.aggregate([
      { $match: { status: "published" } },
      { $unwind: "$tags" },
      {
        $group: {
          _id: "$tags",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } }, // Sort by count in descending order
      {
        $project: {
          _id: 0,
          tag: "$_id",
          count: 1,
        },
      },
    ]);
    if (!tags || tags.length === 0) {
      return res.status(200).send({
        data: [],
        message: "No published tags found",
      });
    }
    const mappedTags = tags.map((tag) => tag.tag); // Extract tag names
    // Map tags to a simpler format
    res.status(200).send({
      data: mappedTags,
      message: "Published tags fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const getPublishedBlogPostsByTag = async (req, res) => {
  try {
    const { tags } = req.query;
    console.log("tags", tags, typeof tags);
    if (!tags || tags.length === 0) {
      return res
        .status(400)
        .send({ error: "Tags are required and must not be empty" });
    }
    // if tags include all then return all published blog posts
    const query = {};
    if (tags.includes("All")) {
      console.log("Fetching all published blog posts");
      query.status = "published";
    } else {
      // if tags is a string, convert it to an array
      if (typeof tags === "string") {
        query.tags = tags
          .split(",")
          .map((tag) => tag.trim().replace(/[^a-zA-Z0-9 ]/g, ""));
      }
      if (query.tags && !Array.isArray(query.tags)) {
        return res.status(400).send({ error: "Tags must be an array" });
      }
      if (query.tags && query.tags.length < 1) {
        return res.status(400).send({ error: "At least one tag is required" });
      }
      // Fetch all published blog posts with the specified tags
      // Use $in operator to match any of the tags in the array
      if (query.tags) {
        query.tags = { $in: query.tags };
      }
    }
    const blogPosts = await BlogPostModel.find({
      status: "published",
      ...query, // Allow filtering by other query parameters
    })
      .populate("author", "firstname lastName email social")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).send({
      data: blogPosts,
      message: "Published blog posts by tag fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const getBlogPost = async (req, res) => {
  try {
    const { blogPostId, isAdmin } = req.query;
    if (!blogPostId) {
      return res.status(400).send({ error: "Blog post ID is required" });
    }
    const blogPost = await BlogPostModel.findOne({ blogPostId })
      .populate(
        "author",
        "firstname lastName displayName email social imageUrl"
      )
      .lean();
    if (!isAdmin && blogPost && blogPost.status === "published") {
      // update impressions count
      const updatedBlogPost = await BlogPostModel.findOneAndUpdate(
        { blogPostId },
        { $inc: { impressions: 1 } },
        { new: true }
      );
      blogPost.impressions = updatedBlogPost.impressions;
    }

    res.status(200).send({
      data: blogPost,
      message: "Blog post fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const updateBlogPost = async (req, res) => {
  let image = {};
  try {
    const { blogPostId } = req.body;
    if (!blogPostId) {
      return res.status(400).send({ error: "Blog post ID is required" });
    }
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).send({ error: "Title and content are required" });
    }
    let tags = req.body.tags;
    if (!tags) {
      tags = [];
    }
    // convert tags to an array if it's a string and trim whitespace and remove all special characters
    if (tags && typeof tags === "string") {
      tags = tags
        .split(",")
        .map((tag) => tag.trim().replace(/[^a-zA-Z0-9 ]/g, ""));
    }

    if (tags && !Array.isArray(tags)) {
      return res.status(400).send({ error: "Tags must be an array" });
    }

    if (!tags) {
      return res.status(400).send({ error: "Tags are required" });
    }

    if (tags && tags.length < 1) {
      return res.status(400).send({ error: "At least one tag is required" });
    }

    const blogPost = await BlogPostModel.findOne({ blogPostId });
    if (!blogPost) {
      return res.status(404).send({ error: "Blog post not found" });
    }
    const blogPostImageName =
      blogPost.image && blogPost.image.name ? blogPost.image.name : null;
    const authUser = await getAuthUser(req);

    const isAuthor = authUser && authUser.isBlogAuthor;
    if (!isAuthor) {
      return res
        .status(403)
        .send({ error: "Unauthorized to update blog posts" });
    }

    if (req.file) {
      const filename = req.file.filename;
      image = await addImage(req, filename);
      blogPost.image = image;
    }

    blogPost.title = title;
    blogPost.content = content;
    blogPost.tags = tags;

    await blogPost.save();
    // If the image was updated, delete the old image from Firebase
    if (blogPostImageName && image.name && blogPostImageName !== image.name) {
      await deleteImageFromFirebase(blogPostImageName);
    }

    res.status(200).send({
      message: "Blog post updated successfully",
      data: blogPost,
    });
  } catch (error) {
    if (image && image.name) {
      await deleteImageFromFirebase(image.name);
    }
    res.status(400).send({ error: error.message });
  }
};

const addPostComment = async (req, res) => {
  try {
    const { blogPostId, fullName, email, comment } = req.body;
    if (!blogPostId) {
      return res.status(400).send({ error: "Blog post ID is required" });
    }
    if (!fullName || !email || !comment) {
      return res.status(400).send({
        error: "Full name, email, and comment are required",
      });
    }
    const blog = await BlogPostModel.findOne({ blogPostId });
    if (!blog) {
      return res.status(404).send({ error: "Blog post not found" });
    }
    const newComment = new BlogCommentModel({
      blogPost: blog._id,
      fullName,
      email,
      comment,
      childrenComments: [],
      parentComment: null, // No parent comment for top-level comments
    });
    await newComment.save();
    res.status(201).send({
      message: "Comment added successfully",
      data: newComment,
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const replyComment = async (req, res) => {
  try {
    const { blogPostId, fullName, email, comment, parentComment } = req.body;
    if (!blogPostId) {
      return res.status(400).send({ error: "Blog post ID is required" });
    }
    if (!fullName || !email || !comment) {
      return res.status(400).send({
        error: "Full name, email, and comment are required",
      });
    }
    if (!parentComment) {
      return res.status(400).send({ error: "Parent comment ID is required" });
    }
    const blog = await BlogPostModel.findOne({ blogPostId });
    if (!blog) {
      return res.status(404).send({ error: "Blog post not found" });
    }
    const parentCommentDoc = await BlogCommentModel.findById(parentComment);
    if (!parentCommentDoc) {
      return res.status(404).send({ error: "Parent comment not found" });
    }
    const newComment = new BlogCommentModel({
      blogPost: blog._id,
      fullName,
      email,
      comment,
      parentComment: parentCommentDoc._id,
    });
    await newComment.save();
    const updateParentComment = await BlogCommentModel.findByIdAndUpdate(
      parentCommentDoc._id,
      { $push: { childrenComments: newComment._id } },
      { new: true }
    );

    return res.status(201).send({
      message: "Reply added successfully",
      data: newComment,
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const getPostComments = async (req, res) => {
  try {
    const { blogPostId } = req.query;
    if (!blogPostId) {
      return res.status(400).send({ error: "Blog post ID is required" });
    }
    // check blog post exists
    const blogPost = await BlogPostModel.findOne({ blogPostId });
    if (!blogPost) {
      return res.status(404).send({ error: "Blog post not found" });
    }

    // fetch all comments for the blog post with the given blogPostId
    // get all children comments for each comment
    // each comment can have one parentComment or null
    // comment can have multiple childrenComments as array
    const aggregatePipeline = [
      {
        $match: {
          blogPost: ObjectId(blogPost._id),
          parentComment: null, // Match top-level comments only
        }, // Match comments for the specific blog post
      },
      {
        $graphLookup: {
          from: "BlogComments",
          startWith: "$_id",
          connectFromField: "_id",
          connectToField: "parentComment",
          as: "childrenComments",
          depthField: "depth", // Optional, to track the depth of the comment
        },
      },
      // sort childrenComments by createdAt in ascending order
      {
        $addFields: {
          childrenComments: {
            $sortArray: {
              input: "$childrenComments",
              sortBy: { createdAt: 1 },
            },
          },
        },
      },
      // map childrenComments to include parentComment details
      {
        $lookup: {
          from: "BlogComments",
          localField: "childrenComments.parentComment",
          foreignField: "_id",
          as: "parentCommentDetails",
        },
      },
      // for all children comments, look up the blog post details
      {
        $lookup: {
          from: "BlogPosts",
          localField: "blogPost",
          foreignField: "_id",
          as: "blogPostDetails",
        },
      },
      {
        $unwind: "$blogPostDetails",
      },
      {
        $project: {
          _id: 1,
          fullName: 1,
          email: 1,
          comment: 1,
          createdAt: 1,
          updatedAt: 1,
          blogPostId: "$blogPostDetails.blogPostId",
          childrenComments: {
            $map: {
              input: "$childrenComments",
              as: "child",
              in: {
                _id: "$$child._id",
                fullName: "$$child.fullName",
                email: "$$child.email",
                comment: "$$child.comment",
                createdAt: "$$child.createdAt",
                updatedAt: "$$child.updatedAt",
                parentComment: {
                  $cond: {
                    if: { $eq: ["$$child.parentComment", null] },
                    then: null,
                    // look up parent comment details
                    else: {
                      $arrayElemAt: [
                        "$parentCommentDetails",
                        {
                          $indexOfArray: [
                            "$parentCommentDetails._id",
                            "$$child.parentComment",
                          ],
                        },
                      ],
                    },
                  },
                }, // Include parentComment field
              },
            },
          },

          depth: {
            $cond: {
              if: { $isArray: "$childrenComments" },
              then: { $size: "$childrenComments" },
              else: 0,
            },
          }, // Include depth of the comment
          childrenCommentsCount: { $size: "$childrenComments" }, // Count of children comments
        },
      },
    ];
    const comments = await BlogCommentModel.aggregate(aggregatePipeline);

    res.status(200).send({
      data: comments,
      message: "Comments fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const deleteBlogPost = async (req, res) => {
  try {
    const { blogPostId } = req.body;

    if (!blogPostId) {
      return res.status(400).send({ error: "Blog post ID is required" });
    }
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res.status(401).send({ error: "Unauthorized" });
    }
    // Check if the blog post exists
    const blogPost = await BlogPostModel.findOne({ blogPostId });
    if (!blogPost) {
      return res.status(404).send({ error: "Blog post not found" });
    }
    const blogPostImageName =
      blogPost.image && blogPost.image.name ? blogPost.image.name : null;

    const isAuthor = authUser && authUser.isBlogAuthor;
    if (!isAuthor) {
      return res
        .status(403)
        .send({ error: "Unauthorized to delete blog posts" });
    }

    await BlogPostModel.deleteOne({ blogPostId });
    // Delete the image from Firebase if it exists
    if (blogPostImageName) {
      await deleteImageFromFirebase(blogPostImageName);
    }

    res.status(200).send({
      message: "Blog post deleted successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const changeBlogPostStatus = async (req, res) => {
  try {
    const { blogPostId, status } = req.body;
    if (!blogPostId) {
      return res.status(400).send({ error: "Blog post ID is required" });
    }
    if (!status || !["draft", "published", "archived"].includes(status)) {
      return res.status(400).send({ error: "Invalid status" });
    }
    const blogPost = await BlogPostModel.findOne({ blogPostId });
    if (!blogPost) {
      return res.status(404).send({ error: "Blog post not found" });
    }
    const authUser = await getAuthUser(req);
    const isAuthor = authUser && authUser.isBlogAuthor;
    if (!isAuthor) {
      return res
        .status(403)
        .send({ error: "Unauthorized to change blog post status" });
    }
    const isAdmin = authUser.isAdmin || authUser.superAdmin;
    if (!isAdmin && status !== "draft") {
      return res
        .status(403)
        .send({ error: "Unauthorized to change blog post status" });
    }
    blogPost.status = status;
    await blogPost.save();
    res.status(200).send({
      message: "Blog post status updated successfully",
      data: blogPost,
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const getBlogAnalytics = async (req, res) => {
  try {
    const data = {};
    const blogPosts = await BlogPostModel.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          impressions: { $sum: "$impressions" },
        },
      },
      {
        $project: {
          _id: 0,
          status: "$_id",
          count: 1,
          impressions: 1,
        },
      },
    ]);
    data.blogPostsByStatus = blogPosts.reduce((acc, item) => {
      acc[item.status] = {
        count: item.count,
        impressions: item.impressions,
      };
      return acc;
    }, {});
    const totalBlogPosts = await BlogPostModel.countDocuments({});
    data.totalBlogPosts = totalBlogPosts;
    const totalImpressions = blogPosts.reduce((acc, item) => {
      return acc + item.impressions;
    }, 0);
    data.totalImpressions = totalImpressions;
    const totalAuthors = await BlogPostModel.distinct("author");

    data.totalAuthors = totalAuthors?.length || 0;
    const topAuthors = await BlogPostModel.aggregate([
      {
        $group: {
          _id: "$author",
          count: { $sum: 1 },
          impressions: { $sum: "$impressions" },
        },
      },
      {
        $lookup: {
          from: "Users",
          localField: "_id",
          foreignField: "_id",
          as: "authorDetails",
        },
      },
      {
        $unwind: "$authorDetails",
      },
      {
        $project: {
          _id: 0,
          authorId: "$_id",

          authorName: "$authorDetails.displayName",
          count: 1,
          impressions: 1,
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 }, // Get top 5 authors
    ]);
    data.topAuthors = topAuthors.map((author) => ({
      authorId: author.authorId,
      authorName: author.authorName,
      count: author.count,
      impressions: author.impressions,
    }));
    const topBlogPosts = await BlogPostModel.aggregate([
      {
        $project: {
          _id: 0,
          blogPostId: 1,
          title: 1,
          impressions: 1,
          status: 1,
        },
      },
      { $sort: { impressions: -1 } },
      { $limit: 5 }, // Get top 5 blog posts by impressions
    ]);
    data.topBlogPosts = topBlogPosts.map((post) => ({
      blogPostId: post.blogPostId,
      title: post.title,
      impressions: post.impressions,
      status: post.status,
    }));
    const totalComments = await BlogCommentModel.countDocuments({});
    data.totalComments = totalComments;
    const commentsByBlogPost = await BlogCommentModel.aggregate([
      {
        $group: {
          _id: "$blogPost",
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "BlogPosts",
          localField: "_id",
          foreignField: "_id",
          as: "blogPostDetails",
        },
      },
      {
        $unwind: "$blogPostDetails",
      },
      {
        $project: {
          _id: 0,
          blogPostId: "$blogPostDetails.blogPostId",
          title: "$blogPostDetails.title",
          count: 1,
        },
      },
    ]);
    data.commentsByBlogPost = commentsByBlogPost.map((comment) => ({
      blogPostId: comment.blogPostId,
      title: comment.title,
      count: comment.count,
    }));
    res.status(200).send({
      data,
      message: "Blog analytics fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const makeUserBlogAuthor = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).send({ error: "User ID is required" });
    }
    const user = await UserModel.findOne({ userId });
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }
    const authUser = await getAuthUser(req);
    if (!authUser || !authUser.isAdmin) {
      return res
        .status(403)
        .send({ error: "Unauthorized to make user a blog author" });
    }
    // Check if the user is already a blog author
    if (user.isBlogAuthor) {
      return res.status(400).send({ error: "User is already a blog author" });
    }
    // Update the user to make them a blog author
    const updateUser = await UserModel.findByIdAndUpdate(
      user._id,
      { isBlogAuthor: true },
      { new: true }
    );
    userCache.set(updatedUser.uid, updatedUser);
    res.status(200).send({
      message: "User made a blog author successfully",
      data: updateUser,
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const removeUserBlogAuthor = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).send({ error: "User ID is required" });
    }
    const user = await UserModel.findOne({ userId });
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }
    const authUser = await getAuthUser(req);
    if (!authUser || !authUser.isAdmin) {
      return res
        .status(403)
        .send({ error: "Unauthorized to remove user as a blog author" });
    }
    // Check if the user is already a blog author
    if (!user.isBlogAuthor) {
      return res.status(400).send({ error: "User is not a blog author" });
    }
    // Update the user to remove them as a blog author
    const updateUser = await UserModel.findByIdAndUpdate(
      user._id,
      { isBlogAuthor: false },
      { new: true }
    );
    res.status(200).send({
      message: "User removed as a blog author successfully",
      data: updateUser,
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

module.exports = {
  createBlogPost,
  getBlogPosts,
  getPublishedBlogPosts,
  getSimilarPublisedBlogPosts,
  getBlogPost,
  updateBlogPost,
  addPostComment,
  getPostComments,
  replyComment,
  deleteBlogPost,
  changeBlogPostStatus,
  getBlogAnalytics,
  makeUserBlogAuthor,
  removeUserBlogAuthor,
  getPublishedTags,
  getPublishedBlogPostsByTag,
};
