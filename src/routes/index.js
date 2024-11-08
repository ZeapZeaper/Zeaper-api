const express = require("express");
const router = express.Router();
//const organisationUsersResolver = require("../resolvers/organisationUsers");

const { upload, uploadMultiple } = require("../middleware/uploadImage");
const { authMiddleware, authUserAdminMiddleware } = require("../middleware/firebaseUserAuth");
const homeResolver = require("../resolvers/home");
const userResolver = require("../resolvers/user");
const shopResolver = require("../resolvers/shop");
const productResolver = require("../resolvers/products/product");
const commentResolver = require("../resolvers/comment");

const handleMoreFieldsUploads = uploadMultiple.fields([
  { name: "documents", maxCount: 5 },
  { name: "images", maxCount: 10 },
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
  router.get("/users", authMiddleware,authUserAdminMiddleware, userResolver.getUsers);
  router.get("/user", authMiddleware, userResolver.getUser);
  router.get("/userByUid", authMiddleware, userResolver.getUserByUid);
  router.get("/userById", authMiddleware, authUserAdminMiddleware,userResolver.getUserById);
  router.get("/admin/users", authMiddleware, authUserAdminMiddleware, userResolver.getAdminUsers);
  router.put("/user/verifyUserOTP", authMiddleware, userResolver.verifyUserOTP);
  router.put("/user/sendOTPToUser", authMiddleware, userResolver.sendOTPToUser);
  router.put("/user/update", authMiddleware, userResolver.updateUser);
  router.put("/user/update/profilePic", authMiddleware,upload, userResolver.uploadProfilePic);
  router.put("/user/delete", authMiddleware, userResolver.deleteUsers);
  router.delete(
    "/user/delete/absolute",
    authMiddleware,
    authUserAdminMiddleware,
    userResolver.absoluteDeleteUser
  );
  router.put("/user/restore", authMiddleware,authUserAdminMiddleware, userResolver.restoreUser);

  //Shop routes
  router.post("/shop/create", authMiddleware, shopResolver.createShop);
  router.get("/shops", authMiddleware,authUserAdminMiddleware, shopResolver.getShops);
  router.get("/shops/auth", authMiddleware,authUserAdminMiddleware, shopResolver.getAuthUserShops );
  router.get("/shop", authMiddleware, shopResolver.getShop);
  router.put("/shop/update", authMiddleware, shopResolver.updateShop);
  router.put("/shop/delete", authMiddleware, shopResolver.deleteShop);
  router.delete(
    "/shop/delete/absolute",
    authMiddleware,
    authUserAdminMiddleware,
    shopResolver.absoluteDeleteShop
  );
  router.put("/shop/restore", authMiddleware,authUserAdminMiddleware, shopResolver.restoreShop);

  //Product routes
  router.post(
    "/product/create",
    authMiddleware,
    handleMoreFieldsUploads,
    productResolver.createProduct
  );
  router.get("/products", authMiddleware,authUserAdminMiddleware, productResolver.getProducts);
  router.get("/products/getCategoryProducts", authMiddleware, productResolver.getCategoryProducts);
  router.get("/products/live", authMiddleware, productResolver.getLiveProducts);
  router.get("/products/live/newest", authMiddleware, productResolver.getNewestArrivals);
  router.get("/products/live/mostPopular", authMiddleware, productResolver.getMostPopular);
  router.get("/products/searchProducts", authMiddleware,authUserAdminMiddleware, productResolver.searchProducts);
  router.get("/products/live/searchProducts", authMiddleware, productResolver.searchLiveProducts);
  router.get("/products/options", authMiddleware, productResolver.getProductOptions);
  router.get("/products/shop/draft", authMiddleware, productResolver.getShopDraftProducts);
  router.get("/product", authMiddleware, productResolver.getProduct);
  router.get("/product/id", authMiddleware, productResolver.getProductById);
  router.put("/product/update", authMiddleware, productResolver.editProduct);
  router.put("/product/update/addProductVariation", authMiddleware, productResolver. addProductVariation);
  router.put("/product/update/deleteProductColor", authMiddleware, productResolver.deleteProductColor);
  router.put("/product/update/deleteProductImage", authMiddleware, productResolver.deleteProductImage);
  router.put("/product/update/setProductImageAsDefault", authMiddleware, productResolver.setProductImageAsDefault);
  router.put("/product/update/addImagesToProductColor", authMiddleware,    handleMoreFieldsUploads, productResolver.addImagesToProductColor);
  router.put("/product/update/editProductVariation", authMiddleware,    handleMoreFieldsUploads, productResolver.editProductVariation);
  router.put("/product/update/deleteProductVariation", authMiddleware, productResolver.deleteProductVariation);
  router.put("/product/update/submitProduct", authMiddleware, productResolver.submitProduct);
  

  router.put(
    "/product/update/addColorAndImages",
    authMiddleware,
    handleMoreFieldsUploads,
    productResolver.addProductColorAndImages
  );
  
  
  

//comments routes
  router.post("/comment/create", authMiddleware, authUserAdminMiddleware,commentResolver.createComment);
  router.get("/comment/user", authMiddleware,authUserAdminMiddleware, commentResolver.getUserComments);
  router.get("/comment/shop", authMiddleware,authUserAdminMiddleware, commentResolver.getShopComments);
  router.put("/comment/update", authMiddleware,authUserAdminMiddleware, commentResolver.updateComment);
  router.put("/comment/delete", authMiddleware,authUserAdminMiddleware, commentResolver.deleteComment);

  return app.use("/", router);
};

module.exports = routes;
