const express = require("express");
const router = express.Router();
//const organisationUsersResolver = require("../resolvers/organisationUsers");

const {
  upload,
  uploadMultiple,
  validateFileSizes,
} = require("../middleware/uploadImage");
const {
  authMiddleware,
  authUserAdminMiddleware,
} = require("../middleware/firebaseUserAuth");
const homeResolver = require("../resolvers/home");
const userResolver = require("../resolvers/user");
const shopResolver = require("../resolvers/shop");
const productResolver = require("../resolvers/products/product");
const commentResolver = require("../resolvers/comment");
const reviewResolver = require("../resolvers/review");
const promoResolver = require("../resolvers/promo");
const basketResolver = require("../resolvers/basket");
const paymentResolver = require("../resolvers/payment");
const deliveryAddressResolver = require("../resolvers/deliveryAddress");
const bodyMeasurementTemplateResolver = require("../resolvers/bodyMeasurementTemplateModel");
const bodyMeasurementResolver = require("../resolvers/bodyMeasurement");
const orderResolver = require("../resolvers/order");
const pointResolver = require("../resolvers/point");
const voucherResolver = require("../resolvers/voucher");
const wishResolver = require("../resolvers/wish");
const analyticsResolver = require("../resolvers/analytics");
const bodyMeasurementGuideResolver = require("../resolvers/bodyMeasurementGuide");
const deliveryFeeResolver = require("../resolvers/deliveryFee");
const exchangeRateResolver = require("../resolvers/exchangeRate");
const notificationResolver = require("../resolvers/notification");
const emailTemplateResolver = require("../resolvers/emailTemplate");

const handleMoreFieldsUploads = uploadMultiple.fields([
  { name: "documents", maxCount: 5 },
  { name: "images", maxCount: 5 },
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
    "/user/guest/create",
    authMiddleware,
    upload,
    userResolver.creatGuestUser
  );
  router.post(
    "/user/guest/convert/emailPassword",
    authMiddleware,
    upload,
    userResolver.convertGuestUserWithEmailPasswordProvider
  );
  router.post(
    "/user/guest/convert/googleApple",
    authMiddleware,
    upload,
    userResolver.ConvertGuestUserWithGooglAppleProvider
  );
  router.post(
    "/user/create/googleApple",
    authMiddleware,
    upload,
    validateFileSizes,
    userResolver.createUserWithGoogleOrApple
  );
  router.get(
    "/users",
    authMiddleware,
    authUserAdminMiddleware,
    userResolver.getUsers
  );
  router.get("/user", authMiddleware, userResolver.getUser);
  router.get("/userByUid", authMiddleware, userResolver.getUserByUid);
  router.get(
    "/userById",
    authMiddleware,
    authUserAdminMiddleware,
    userResolver.getUserById
  );
  router.get(
    "/admin/users",
    authMiddleware,
    authUserAdminMiddleware,
    userResolver.getAdminUsers
  );
  router.put("/user/verifyUserOTP", authMiddleware, userResolver.verifyUserOTP);
  router.put("/user/sendOTPToUser", authMiddleware, userResolver.sendOTPToUser);
  router.put("/user/update", authMiddleware, userResolver.updateUser);
  router.put(
    "/user/update/profilePic",
    authMiddleware,
    upload,
    validateFileSizes,
    userResolver.uploadProfilePic
  );
  router.put("/user/delete", authMiddleware, userResolver.deleteUsers);
  router.delete(
    "/user/delete/absolute",
    authMiddleware,
    authUserAdminMiddleware,
    userResolver.absoluteDeleteUser
  );
  router.put(
    "/user/restore",
    authMiddleware,
    authUserAdminMiddleware,
    userResolver.restoreUser
  );

  //Shop routes
  router.post("/shop/create", authMiddleware, shopResolver.createShop);
  router.get(
    "/shops",
    authMiddleware,
    authUserAdminMiddleware,
    shopResolver.getShops
  );
  router.get(
    "/shops/auth",
    authMiddleware,
    authUserAdminMiddleware,
    shopResolver.getAuthUserShops
  );
  router.get("/shop", authMiddleware, shopResolver.getShop);
  router.get(
    "/shop/auth/revenues",
    authMiddleware,
    shopResolver.getAuthShopRevenues
  );
  router.get("/shop/revenues", authMiddleware, shopResolver.getShopRevenues);

  router.put("/shop/update", authMiddleware, shopResolver.updateShop);
  router.put("/shop/delete", authMiddleware, shopResolver.deleteShop);
  router.delete(
    "/shop/delete/absolute",
    authMiddleware,
    authUserAdminMiddleware,
    shopResolver.absoluteDeleteShop
  );
  router.put(
    "/shop/restore",
    authMiddleware,
    authUserAdminMiddleware,
    shopResolver.restoreShop
  );

  //Product routes
  router.post("/product/create", authMiddleware, productResolver.createProduct);
  router.get(
    "/products",
    authMiddleware,
    authUserAdminMiddleware,
    productResolver.getProducts
  );
  router.get(
    "/products/auth/shop",
    authMiddleware,
    productResolver.getAuthShopProducts
  );
  router.get(
    "/products/getCategoryProducts",
    authMiddleware,
    productResolver.getCategoryProducts
  );
  router.get("/products/live", authMiddleware, productResolver.getLiveProducts);
  router.get(
    "/products/live/promo",
    authMiddleware,
    productResolver.getPromoWithLiveProducts
  );
  router.get(
    "/products/live/newest",
    authMiddleware,
    productResolver.getNewestArrivals
  );
  router.get(
    "/products/live/mostPopular",
    authMiddleware,
    productResolver.getMostPopular
  );
  router.get(
    "/products/searchProducts",
    authMiddleware,
    authUserAdminMiddleware,
    productResolver.searchProducts
  );
  router.get(
    "/products/live/searchProducts",
    authMiddleware,
    productResolver.searchLiveProducts
  );
  router.get(
    "/products/live/similar",
    authMiddleware,
    productResolver.searchSimilarProducts
  );
  router.get(
    "/products/options",
    authMiddleware,
    productResolver.getProductOptions
  );
  router.get(
    "/products/dynamicFilters",
    authMiddleware,
    productResolver.getQueryProductsDynamicFilters,
  );
  router.get(
    "/products/shop/draft",
    authMiddleware,
    productResolver.getShopDraftProducts
  );
  router.get("/product", authMiddleware, productResolver.getProduct);
  router.get("/product/id", authMiddleware, productResolver.getProductById);
  router.put("/product/update", authMiddleware, productResolver.editProduct);
  router.put(
    "/product/update/status",
    authUserAdminMiddleware,
    productResolver.setProductStatus
  );
  router.put(
    "/product/update/addProductVariation",
    authMiddleware,
    productResolver.addProductVariation
  );
  router.put(
    "/product/update/deleteProductColor",
    authMiddleware,
    productResolver.deleteProductColor
  );
  router.put(
    "/product/update/deleteProductImage",
    authMiddleware,
    productResolver.deleteProductImage
  );
  router.put(
    "/product/update/setProductImageAsDefault",
    authMiddleware,
    productResolver.setProductImageAsDefault
  );
  router.put(
    "/product/update/addImagesToProductColor",
    authMiddleware,
    handleMoreFieldsUploads,
    validateFileSizes,
    productResolver.addImagesToProductColor
  );
  router.put(
    "/product/update/editProductVariation",
    authMiddleware,

    productResolver.editProductVariation
  );
  router.put(
    "/product/update/deleteProductVariation",
    authMiddleware,
    productResolver.deleteProductVariation
  );
  router.put(
    "/product/update/autoPriceAdjustment",
    authMiddleware,
    productResolver.updateAutoPriceAdjustment
  );
  router.put(
    "/product/update/submitProduct",
    authMiddleware,
    productResolver.submitProduct
  );
  router.put("/product/delete", authMiddleware, productResolver.deleteProducts);
  router.put(
    "/product/restore",
    authMiddleware,
    productResolver.restoreProducts
  );

  router.put(
    "/product/update/addColorAndImages",
    authMiddleware,
    handleMoreFieldsUploads,
    validateFileSizes,
    productResolver.addProductColorAndImages
  );

  //Review routes
  router.post("/review/create", authMiddleware, reviewResolver.createReview);
  router.get("/reviews", authMiddleware, reviewResolver.getReviews);
  router.get(
    "/reviews/shop",
    authMiddleware,
    reviewResolver.getReviewsForShopProducts
  );
  router.get("/review", authMiddleware, reviewResolver.getReview);
  router.put("/review/update", authMiddleware, reviewResolver.updateReview);
  router.put(
    "/review/update/likeReview",
    authMiddleware,
    reviewResolver.likeReview
  );
  router.put(
    "/review/update/dislikeReview",
    authMiddleware,
    reviewResolver.dislikeReview
  );
  router.delete("/review/delete", authMiddleware, reviewResolver.deleteReview);

  // Promo routes
  router.post(
    "/promo/create",
    authMiddleware,
    authUserAdminMiddleware,
    uploadMultiple.fields([
      { name: "smallScreenImageUrl", maxCount: 1 },
      { name: "largeScreenImageUrl", maxCount: 1 },
    ]),
    validateFileSizes,
    promoResolver.createPromo
  );
  router.get(
    "/promos",
    authMiddleware,
    authUserAdminMiddleware,
    promoResolver.getPromos
  );
  router.get(
    "/promos/available",
    authMiddleware,
    promoResolver.getAvailablePromos
  );
  router.get("/promos/live", authMiddleware, promoResolver.getLivePromos);
  router.get("/promos/draft", authMiddleware, promoResolver.getDraftPromos);
  router.get(
    "/promos/scheduled",
    authMiddleware,
    promoResolver.getScheduledPromos
  );
  router.get(
    "/promos/finished",
    authMiddleware,
    promoResolver.getFinishedPromos
  );
  router.get("/promo/products", productResolver.getPromoWithLiveProducts);
  router.get("/promo", promoResolver.getPromo);
  router.get("/product/promo", authMiddleware, promoResolver.getProductPromo);
  router.put(
    "/promo/update",
    authMiddleware,
    authUserAdminMiddleware,
    uploadMultiple.fields([
      { name: "smallScreenImageUrl", maxCount: 1 },
      { name: "largeScreenImageUrl", maxCount: 1 },
    ]),
    validateFileSizes,
    promoResolver.updatePromo
  );
  router.put(
    "/promo/update/image",
    authMiddleware,
    authUserAdminMiddleware,
    upload,
    validateFileSizes,
    promoResolver.updatePromoImage
  );
  router.delete(
    "/promo/delete",
    authMiddleware,
    authUserAdminMiddleware,
    promoResolver.deletePromo
  );
  router.put("/promo/join", authMiddleware, promoResolver.joinPromo);
  router.put("/promo/leave", authMiddleware, promoResolver.leavePromo);
  router.put("/promo/schedule", authMiddleware, promoResolver.schedulePromo);
  router.put("/promo/activate", authMiddleware, promoResolver.activatePromo);
  router.put("/promo/expire", authMiddleware, promoResolver.expirePromo);

  //comments routes
  router.post(
    "/comment/create",
    authMiddleware,
    authUserAdminMiddleware,
    commentResolver.createComment
  );
  router.get(
    "/comment/user",
    authMiddleware,
    authUserAdminMiddleware,
    commentResolver.getUserComments
  );
  router.get(
    "/comment/shop",
    authMiddleware,
    authUserAdminMiddleware,
    commentResolver.getShopComments
  );
  router.put(
    "/comment/update",
    authMiddleware,
    authUserAdminMiddleware,
    commentResolver.updateComment
  );
  router.put(
    "/comment/delete",
    authMiddleware,
    authUserAdminMiddleware,
    commentResolver.deleteComment
  );

  //Basket routes
  router.post(
    "/basket/product/add",
    authMiddleware,
    basketResolver.addProductToBasket
  );
  router.get(
    "/baskets",
    authMiddleware,
    authUserAdminMiddleware,
    basketResolver.getBaskets
  );
  router.get("/basket/total", authMiddleware, basketResolver.getBasketTotal);
  router.get("/basket", authMiddleware, basketResolver.getBasket);
  router.delete("/basket/delete", authMiddleware, basketResolver.deleteBasket);
  router.put(
    "/basket/product/remove",
    authMiddleware,
    basketResolver.removeProductFromBasket
  );
  router.put(
    "/basket/product/increase",
    authMiddleware,
    basketResolver.increaseProductQuantity
  );
  router.put(
    "/basket/product/decrease",
    authMiddleware,
    basketResolver.decreaseProductQuantity
  );

  //Payment routes

  router.get(
    "/payment/reference",
    authMiddleware,
    paymentResolver.getReference
  );
  router.get(
    "/payments/",
    authMiddleware,
    authUserAdminMiddleware,
    paymentResolver.getPayments
  );
  router.get("/payment", authMiddleware, paymentResolver.getPayment);

  router.post("/payment/verify", authMiddleware, paymentResolver.verifyPayment);
  router.put("/payment/shop", authMiddleware, paymentResolver.payShop);
  router.put(
    "/payment/revert/shop",
    authMiddleware,
    paymentResolver.revertPayShop
  );

  // delivery address routes
  router.post(
    "/deliveryAddress/create",
    authMiddleware,
    deliveryAddressResolver.createDeliveryAddress
  );
  router.get(
    "/deliveryAddresses",
    authMiddleware,
    deliveryAddressResolver.getDeliveryAddresses
  );
  router.get(
    "/deliveryAddress",
    authMiddleware,
    deliveryAddressResolver.getDeliveryAddress
  );
  router.put(
    "/deliveryAddress/update",
    authMiddleware,
    deliveryAddressResolver.updateDeliveryAddress
  );
  router.put(
    "/deliveryAddress/setDefault",
    authMiddleware,
    deliveryAddressResolver.setDefaultDeliveryAddress
  );
  router.delete(
    "/deliveryAddress/delete",
    authMiddleware,
    deliveryAddressResolver.deleteDeliveryAddress
  );

  // body measurement template routes
  router.post(
    "/bodyMeasurementTemplate/add",
    authMiddleware,
    bodyMeasurementTemplateResolver.addBodyMeasurementTemplate
  );
  router.get(
    "/bodyMeasurementEnums",
    authMiddleware,
    bodyMeasurementTemplateResolver.getBodyMeasurementEums
  );
  router.get(
    "/bodyMeasurementTemplates",
    authMiddleware,
    bodyMeasurementTemplateResolver.getBodyMeasurementTemplates
  );
  router.get(
    "/bodyMeasurementTemplate",
    authMiddleware,
    bodyMeasurementTemplateResolver.getBodyMeasurementTemplate
  );
  router.get(
    "/bodyMeasurementTemplate/authUser",
    authMiddleware,
    bodyMeasurementTemplateResolver.getAuthUserBodyMeasurementTemplates
  );

  router.put(
    "/bodyMeasurementTemplate/update",
    authMiddleware,
    bodyMeasurementTemplateResolver.updateBodyMeasurementTemplate
  );
  router.delete(
    "/bodyMeasurementTemplate/delete",
    authMiddleware,
    bodyMeasurementTemplateResolver.deleteBodyMeasurementTemplate
  );

  // body measurement routes
  router.post(
    "/product/bodyMeasurement/add",
    authMiddleware,
    bodyMeasurementResolver.addBodyMeasurement
  );
  router.get(
    "/bodyMeasurement/product",
    authMiddleware,
    bodyMeasurementResolver.getProductBodyMeasurement
  );

  // order routes

  router.get(
    "/orders",
    authMiddleware,
    authUserAdminMiddleware,
    orderResolver.getOrders
  );
  router.get("/order", orderResolver.getOrder);
  router.get("/order/authUser/buyer/orderId", orderResolver.getOrderByOrderId,);
  router.get(
    "/order/authUser/buyer/order",
    authMiddleware,
    authUserAdminMiddleware,
    orderResolver.getOrder
  );
  router.get(
    "/orders/authUser/buyer",
    authMiddleware,
    orderResolver.getAuthBuyerOrders
  );
  router.get(
    "/orders/authUser/vendor",
    authMiddleware,
    orderResolver.getAuthVendorProductOrders
  );
  router.get(
    "/orders/products",
    authMiddleware,
    orderResolver.getProductOrders
  );
  router.get("/orders/product", authMiddleware, orderResolver.getProductOrder);
  router.get(
    "/orders/authUser/vendor/product",
    authMiddleware,
    orderResolver.getProductOrder
  );
  router.get(
    "/orders/product-order/status/history",
    authMiddleware,
    orderResolver.getProductOrderStatusHistory
  );
  router.get(
    "/orders/status/options",
    authMiddleware,
    orderResolver.getOrderStatusOptions
  );
  router.put(
    "/order/status",
    authMiddleware,
    orderResolver.updateProductOrderStatus
  );
  router.put("/order/cancel", authMiddleware, orderResolver.cancelOrder);
  router.post(
    "/order/reciept/download",
    authMiddleware,
    orderResolver.downloadReciept
  );

  // point routes

  router.get("/point/authUser", authMiddleware, pointResolver.getAuthUserPoint);
  router.get("/point/user", authMiddleware, pointResolver.getUserPoint);
  router.post(
    "/point/convert/voucher",
    authMiddleware,
    pointResolver.convertPointToVoucher
  );

  // Voucher routes

  router.get(
    "/vouchers/authUser/active",
    authMiddleware,
    voucherResolver.getAuthUserActiveVouchers
  );
  router.get(
    "/vouchers/authUser/inactive",
    authMiddleware,
    voucherResolver.getAuthUserInactiveVouchers
  );
  router.get("/vouchers", authMiddleware, voucherResolver.getVouchers);
  router.get("/voucher", authMiddleware, voucherResolver.getVoucher);
  router.put("/voucher/apply", authMiddleware, voucherResolver.applyVoucher);
  router.post("/voucher/issue", authMiddleware, voucherResolver.issueVoucher);

  // Wish routes
  router.post("/wish/add", authMiddleware, wishResolver.addWish);
  router.delete("/wish/remove", authMiddleware, wishResolver.removeWish);
  router.get("/wish/auth/user", authMiddleware, wishResolver.getAuthUserWishes);
  router.get("/wish/user", authMiddleware, wishResolver.getUserWishes);

  // Analytics routes
  router.get(
    "/analytics/shop",
    authMiddleware,
    analyticsResolver.getShopAnalytics
  );
  router.get(
    "/analytics/products/general",
    authMiddleware,
    analyticsResolver.getProductOrderAnalytics
  );
  router.get(
    "/analytics/count",
    authMiddleware,
    analyticsResolver.getOrderCountAnalytics
  );
  router.get(
    "/analytics/products",
    authMiddleware,
    analyticsResolver.getProductAnalytics
  );
  router.get(
    "/analytics/users/shop/count",
    authMiddleware,
    analyticsResolver.getUsersShopCountAnalytics
  );

  router.get(
    "/analytics/count/productOrders/date",
    authMiddleware,
    analyticsResolver.getProductOrdersCountByDate
  );

  // Body Measurement Guide routes
  router.get(
    "/bodyMeasurementGuide/bespoke",
    authMiddleware,
    bodyMeasurementGuideResolver.getBodyMeasurementGuide
  );
  router.get(
    "/bodyMeasurementGuide/bespoke/gallery",
    authMiddleware,
    bodyMeasurementGuideResolver.getFieldImagesGallery
  );
  router.get(
    "/bodyMeasurementGuide/bespoke/fields",
    authMiddleware,
    bodyMeasurementGuideResolver.getBodyMeasurementGuideFields
  );
  router.put(
    "/bodyMeasurementGuide/bespoke/field/Image",
    authMiddleware,
    authUserAdminMiddleware,
    upload,
    bodyMeasurementGuideResolver.updateFieldImage
  );
  router.put(
    "/bodyMeasurementGuide/bespoke/field/Image/delete",
    authMiddleware,
    authUserAdminMiddleware,
    bodyMeasurementGuideResolver.deleteBodyMeasurementFieldImage
  );
  router.put(
    "/bodyMeasurementGuide/bespoke/field/update",
    authMiddleware,
    authUserAdminMiddleware,
    bodyMeasurementGuideResolver.editBodyMeasurementField
  );
  router.put(
    "/bodyMeasurementGuide/bespoke/field/delete",
    authMiddleware,
    authUserAdminMiddleware,
    bodyMeasurementGuideResolver.deleteBodyMeasurementField
  );
  router.delete(
    "/bodyMeasurementGuide/bespoke/delete",
    authMiddleware,
    authUserAdminMiddleware,
    bodyMeasurementGuideResolver.deleteBodyMeasurementGuide
  );
  router.put(
    "/bodyMeasurementGuide/bespoke/name/update",
    authMiddleware,
    authUserAdminMiddleware,
    bodyMeasurementGuideResolver.updateBodyMeasurementGuideName
  );
  router.put(
    "/bodyMeasurementGuide/bespoke/field/add",
    authMiddleware,
    authUserAdminMiddleware,
    bodyMeasurementGuideResolver.addBodyMeasurementGuideField
  );
  router.post(
    "/bodyMeasurementGuide/bespoke/add",
    authMiddleware,
    authUserAdminMiddleware,
    bodyMeasurementGuideResolver.addBodyMeasurementGuide
  );

  // Delivery Fee routes
  router.get(
    "/deliveryFee",
    authMiddleware,
    deliveryFeeResolver.getDeliveryFee
  );
  router.put(
    "/deliveryFee/update",
    authMiddleware,
    deliveryFeeResolver.updateDeliveryFee
  );

  // Exchange Rate routes
  router.get(
    "/exchangeRate",
    authMiddleware,
    exchangeRateResolver.getExchangeRate
  );
  router.put(
    "/exchangeRate/update",
    authMiddleware,
    exchangeRateResolver.updateExchangeRate
  );
  // notifications routes
  router.post(
    "/notification/pushToken/register",
    authMiddleware,
    notificationResolver.registerPushToken
  );
  router.post(
    "/notification/test",
    authMiddleware,
    notificationResolver.testPushNotification
  );
  router.get(
    "/notification/inbox",
    authMiddleware,
    notificationResolver.getNotifications
  );
  router.get(
    "/notification/inbox/admins",
    authMiddleware,
    notificationResolver.getAdminsNotifications
  );
  router.put(
    "/notification/inbox/delete",
    authMiddleware,
    notificationResolver.deleteNotification
  );

  // Email Template routes
  router.post(
    "/emailTemplate/add",
    authMiddleware,
    emailTemplateResolver.addEmailTemplate
  );

  router.get(
    "/emailTemplates",
    authMiddleware,
    emailTemplateResolver.getEmailTemplates
  );

  router.get(
    "/emailTemplate",
    authMiddleware,
    emailTemplateResolver.getEmailTemplate
  );

  return app.use("/", router);
};

module.exports = routes;
