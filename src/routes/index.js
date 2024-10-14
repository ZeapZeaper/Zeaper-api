const express = require("express");
const router = express.Router();
//const organisationUsersResolver = require("../resolvers/organisationUsers");

const { upload, uploadMultiple } = require("../middleware/uploadImage");
const { authMiddleware } = require("../middleware/firebaseUserAuth");
const homeResolver = require("../resolvers/home");
const userResolver = require("../resolvers/user");
const shopResolver = require("../resolvers/shop");
const productResolver = require("../resolvers/products/product");
const commentResolver = require("../resolvers/comment");

const handleMoreFieldsUploads = uploadMultiple.fields([
  { name: "documents", maxCount: 5 },
  { name: "pictures", maxCount: 10 },
]);





let routes = (app) => {
  router.get("/", homeResolver.getHome);

  



  // router.post(
  //   "/user/create",
  //   authMiddleware,
  //   upload,
  //   organisationUsersResolver.createOrganisationUsers
  // );

  //User routes
  router.post("/user/create", authMiddleware, upload, userResolver.createUser);
  router.post(
    "/user/create/googleApple",
    authMiddleware,
    upload,
    userResolver.createUserWithGoogleOrApple
  );
  router.get("/users", authMiddleware, userResolver.getUsers);
  router.get("/user", authMiddleware, userResolver.getUser);
  router.get("/userByUid", authMiddleware, userResolver.getUserByUid);
  router.get("/userById", authMiddleware, userResolver.getUserById);
  router.get("/admin/users", authMiddleware, userResolver.getAdminUsers);
  router.put("/user/verifyUserOTP", authMiddleware, userResolver.verifyUserOTP);
  router.put("/user/sendOTPToUser", authMiddleware, userResolver.sendOTPToUser);
  router.put("/user/update", authMiddleware, userResolver.updateUser);
  router.put("/user/update/profilePic", authMiddleware, userResolver.uploadProfilePic);
  router.put("/user/delete", authMiddleware, userResolver.deleteUsers);
  router.delete(
    "/user/delete/absolute",
    authMiddleware,
    userResolver.absoluteDeleteUser
  );
  router.put("/user/restore", authMiddleware, userResolver.restoreUser);

  //Shop routes
  router.post("/shop/create", authMiddleware, shopResolver.createShop);
  router.get("/shops", authMiddleware, shopResolver.getShops);
  router.get("/shop", authMiddleware, shopResolver.getShop);
  router.put("/shop/update", authMiddleware, shopResolver.updateShop);
  router.put("/shop/delete", authMiddleware, shopResolver.deleteShop);
  router.delete(
    "/shop/delete/absolute",
    authMiddleware,
    shopResolver.absoluteDeleteShop
  );
  router.put("/shop/restore", authMiddleware, shopResolver.restoreShop);

  //Product routes
  router.post(
    "/product/create",
    authMiddleware,
    handleMoreFieldsUploads,
    productResolver.createProduct
  );

//comments routes
  router.post("/comment/create", authMiddleware, commentResolver.createComment);
  router.get("/comment/user", authMiddleware, commentResolver.getUserComments);
  router.put("/comment/update", authMiddleware, commentResolver.updateComment);
  router.put("/comment/delete", authMiddleware, commentResolver.deleteComment);

  return app.use("/", router);
};

module.exports = routes;
