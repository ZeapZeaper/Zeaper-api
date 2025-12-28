const { isCancel } = require("axios");
const { orderStatusEnums } = require("../helpers/constants");
const { getAuthUser } = require("../middleware/firebaseUserAuth");
const BasketModel = require("../models/basket");
const DeliveryAddressModel = require("../models/deliveryAddresses");
const OrderModel = require("../models/order");
const ProductOrderModel = require("../models/productOrder");
const ProductModel = require("../models/products");
const ShopModel = require("../models/shop");
const {
  currencyConversion,
  addWeekDays,
  getExpectedStandardDeliveryDate,
  getExpectedExpressDeliveryDate,
  getExpectedVendorCompletionDate,
  replaceProductOrderVariablesinTemplate,
  replaceUserVariablesinTemplate,
  calcShopRevenueValue,
} = require("../helpers/utils");
const { default: mongoose } = require("mongoose");
const {
  addNotification,
  sendPushAllAdmins,
  notifyShop,
  notifyIndividualUser,
} = require("./notification");
const generatePdf = require("../helpers/pdf");
const { ENV } = require("../config");
const { sendEmail } = require("../helpers/emailer");
const EmailTemplateModel = require("../models/emailTemplate");
const url =
  ENV === "prod"
    ? process.env.DOC_DOWNLOAD_URL_PROD
    : process.env.DOC_DOWNLOAD_URL_DEV;

function getRandomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const generateUniqueOrderId = async () => {
  let orderId;
  let found = true;

  do {
    const randomVal = getRandomInt(1000000, 9999999);
    orderId = `${randomVal}`;
    const exist = await OrderModel.findOne(
      {
        orderId,
      },
      { lean: true }
    );

    if (exist) {
      found = true;
    } else {
      found = false;
    }
  } while (found);

  return orderId.toString();
};
const sendProductOrdershopEmail = async (productOrder) => {
  const expectedVendorCompletionDate =
    productOrder.expectedVendorCompletionDate;
  const shop_id = productOrder.shop;
  const shop = await ShopModel.findOne({ _id: shop_id })
    .lean()
    .populate("user");
  const product = await ProductModel.findOne({
    _id: productOrder.product,
  }).lean();
  productOrder.productTitle = product?.title || "";
  if (!shop) {
    return;
  }
  const user = shop?.user;
  const email = shop?.email || user?.email || null;
  if (!email) {
    return;
  }
  const title = "New Order";
  const body = `You have a new order with order ID - ${productOrder.orderId} and item number - ${productOrder.itemNo}. Please complete the order on or before ${expectedVendorCompletionDate?.max}`;
  const productOrderEmailTemplate = await EmailTemplateModel.findOne({
    name: "vendor-new-order",
  }).lean();

  const formattedProductOrderTemplateBody =
    replaceProductOrderVariablesinTemplate(
      replaceUserVariablesinTemplate(productOrderEmailTemplate?.body, user),
      productOrder
    );

  const formattedProductOrderTemplateSubject =
    replaceProductOrderVariablesinTemplate(
      replaceUserVariablesinTemplate(productOrderEmailTemplate?.subject, user),
      productOrder
    );

  const emailParam = {
    from: "admin@zeaper.com",
    to: [email],
    subject: formattedProductOrderTemplateSubject || title,
    body: formattedProductOrderTemplateBody || body,
  };

  const sentEmail = await sendEmail(emailParam);
};

const buildProductOrders = async (
  order,
  basketItems,
  currency,
  deliveryMethod,
  deliveryDetails
) => {
  const productOrders = [];
  const orderId = order.orderId;
  let defaultImage = null;
  const workerTasks = [];

  const promises = basketItems.map(async (item, index) => {
    const product = await ProductModel.findOne({ _id: item.product }).lean();
    if (!product) return;

    const shop = product.shop;
    const itemNo = index + 1;
    const quantity = item.quantity;
    const sku = item.sku;
    const orderedVariations = product?.variations.find((v) => v.sku === sku);
    const size = orderedVariations?.size;
    const color = orderedVariations?.colorValue;
    const images =
      product?.colors
        .find((c) => c.value == color)
        ?.images.map((img) => ({
          link: img.link,
          name: img.name,
        })) || [];

    const variation = product.variations.find((v) => v.sku === sku);
    const originalAmountDue = variation?.price * quantity;
    const amountDue = (variation?.discount || variation.price) * quantity;

    // Multi-currency
    const amount = [{ currency: "NGN", value: amountDue }];
    if (currency === "USD") {
      const usdValue = await currencyConversion(amountDue, "USD");
      amount.push({ currency: "USD", value: usdValue });
    }
    if (currency === "GBP") {
      const gbpValue = await currencyConversion(amountDue, "GBP");
      amount.push({ currency: "GBP", value: gbpValue });
    }

    // Delivery & vendor dates
    const createdAt = new Date();
    const country = deliveryDetails?.country || "Nigeria";
    const productType = product.productType;

    const expectedDeliveryDays =
      deliveryMethod === "express"
        ? getExpectedExpressDeliveryDate(productType, country)
        : getExpectedStandardDeliveryDate(productType, country);
    const expectedDeliveryDate = {
      min: addWeekDays(createdAt, expectedDeliveryDays.min),
      max: addWeekDays(createdAt, expectedDeliveryDays.max),
    };

    const expectedVendorCompletionDays =
      getExpectedVendorCompletionDate(productType);
    const expectedVendorCompletionDate = {
      min: addWeekDays(createdAt, expectedVendorCompletionDays.min),
      max: addWeekDays(createdAt, expectedVendorCompletionDays.max),
    };

    const productOrder = new ProductOrderModel({
      order: order._id,
      orderId,
      itemNo,
      shop,
      product: item.product._id,
      quantity,
      sku,
      bespokeColor: item.bespokeColor,
      bespokeInstruction: item.bespokeInstruction,
      bodyMeasurements: item.bodyMeasurements,
      status: { name: "placed", value: "order placed" },
      amount,
      promo: product.promo,
      color,
      images,
      size,
      shopRevenue: {
        currency: "NGN",
        status: "pending",
        value: calcShopRevenueValue({
          productType,
          originalAmountDue,
          amountDue,
          adminControlledDiscount:
            product?.promo?.adminControlledDiscount || false,
        }),
      },
      deliveryMethod,
      user: order.user,
      expectedDeliveryDate,
      expectedVendorCompletionDate,
    });

    const savedProductOrder = await productOrder.save();
    if (!savedProductOrder) return;

    productOrders.push(savedProductOrder._id);

    if (shop) {
      // Vendor notifications as worker tasks
      workerTasks.push({
        taskType: "notifyShop",
        shop_id: shop.toString(),
        title: "New Order",
        body: `You have a new order with order ID - ${orderId} and item number - ${itemNo}`,
        image: savedProductOrder?.images[0]?.link || null,
        orderId,
        itemNo: itemNo?.toString(),
        productOrder_id: savedProductOrder._id.toString(),
      });

      // Send shop email
      workerTasks.push({
        taskType: "sendProductOrdershopEmail",
        productOrder: savedProductOrder,
      });

      if (!defaultImage && savedProductOrder?.images[0]) {
        defaultImage = savedProductOrder?.images[0]?.link;
      }
    }
  });

  await Promise.all(promises);

  return { productOrders, defaultImage, workerTasks };
};

const createOrder = async ({ payment, user, gainedPoints }) => {
  try {
    const basket = await BasketModel.findOne({ _id: payment.basket }).lean();
    if (!basket) return { error: "Basket not found" };

    const deliveryDetails = basket.deliveryDetails;
    if (!deliveryDetails) return { error: "Delivery details not found" };

    const basketItems = basket.basketItems;
    const orderId = await generateUniqueOrderId();

    const order = new OrderModel({
      orderId,
      user,
      basket: basket._id,
      deliveryDetails,
      payment: payment._id,
      gainedPoints, // handled by worker
    });

    const savedOrder = await order.save();
    if (!savedOrder?._id) return { error: "Order not created" };

    const currency = payment.currency;
    const deliveryMethod = payment?.deliveryMethod;

    const { productOrders, defaultImage, workerTasks } =
      await buildProductOrders(
        savedOrder,
        basketItems,
        currency,
        deliveryMethod,
        deliveryDetails
      );

    if (!productOrders.length) return { error: "Product orders not created" };

    const updatedOrder = await OrderModel.findOneAndUpdate(
      { _id: savedOrder._id },
      { productOrders },
      { new: true }
    );

    // update variation quantities
    await updateVariationQuantity(basketItems, "subtract");

    // delete basket
    await BasketModel.findOneAndDelete({ _id: basket._id });

    // ================= add order-level worker tasks =================
    workerTasks.push({
      taskType: "notifyAdmins",
      orderId,
      user_id: user,
      title: "Order Placed",
      body: `Your order with order ID ${orderId} has been placed successfully`,
      image: defaultImage || null,
    });

    workerTasks.push({
      taskType: "notifyUser",
      orderId,
      user_id: user,
      title: "Order Placed",
      body: `Your order with order ID ${orderId} has been placed successfully`,
      image: defaultImage || null,
    });

    workerTasks.push({
      taskType: "sendBuyerOrderEmail",
      order: {
        _id: updatedOrder._id,
        orderId: updatedOrder.orderId,
        orderPoints: updatedOrder.gainedPoints,
      },
      user_id: user,
      orderId,
    });

    // add loyalty points as worker task
    if (gainedPoints && gainedPoints > 0) {
      workerTasks.push({
        taskType: "addLoyaltyPoints",
        user_id: user,
        points: gainedPoints,
        orderId,
      });
    }

    updatedOrder.defaultImage = defaultImage;

    return {
      order: updatedOrder,
      productOrders,
      workerTasks,
    };
  } catch (err) {
    console.error("createOrder failed", err);
    return { error: "Failed to create order" };
  }
};

const updateVariationQuantity = async (basketItems, action) => {
  return new Promise(async (resolve) => {
    basketItems.forEach(async (item) => {
      const product = await ProductModel.findOne({
        _id: item.product._id,
      }).lean();
      if (!product) {
        return;
      }

      const variations = product.variations;
      const variation = variations.find(
        (variation) => variation.sku === item.sku
      );
      if (!variation) {
        return;
      }
      const isBespoke = variation?.bespoke?.isBespoke
        ? variation.bespoke.isBespoke
        : false;
      if (isBespoke) {
        return;
      }
      const quantity = item.quantity;
      const newQuantity =
        action === "add"
          ? variation.quantity + quantity
          : variation.quantity - quantity;
      await ProductModel.findOneAndUpdate(
        {
          _id: item.product._id,
          "variations.sku": item.sku,
        },
        {
          $set: {
            "variations.$.quantity": newQuantity,
          },
        }
      );
    });
    resolve(true);
  });
};

const getProductOrderPercentage = (allocatedPercentage, productOrder) => {
  const status = orderStatusEnums?.find(
    (status) => status.value === productOrder?.status?.value
  );
  if (!status) return 0;
  // allocatedPercentage is the percentage of the item in the overall order
  const statusPercentage = status?.percentage || 0;
  const productOrderPercentage = (allocatedPercentage / 100) * statusPercentage;
  return productOrderPercentage;
};
const calcOrderProgress = (productOrders) => {
  const total = productOrders?.filter(
    (productOrder) => productOrder?.status?.value !== "order cancelled"
  ).length;
  return productOrders?.reduce((acc, productOrder) => {
    const allocatedPercentage = 100 / total;
    const productOrderPercentage = getProductOrderPercentage(
      allocatedPercentage,
      productOrder
    );
    return acc + productOrderPercentage;
  }, 0);
};
const getAuthBuyerOrders = async (req, res) => {
  try {
    const authUser = req?.cachedUser || (await getAuthUser(req));

    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }

    const orders = await OrderModel.find({ user: authUser._id })
      .populate("productOrders")
      .populate("payment")
      // populate product inside productOrders
      .populate({
        path: "productOrders",
        populate: ["product"],
      })
      .lean();

    if (!orders) {
      return res.status(200).send({ data: [], message: "No orders found" });
    }
    orders.forEach((order) => {
      const productOrders = order.productOrders;
      const progressValue = calcOrderProgress(productOrders);
      const progress = {
        value: progressValue ? progressValue.toFixed(0) : 0,
        max: 100,
        min: 0,
      };
      order.progress = progress;
      // map status enum to each product order
      productOrders.forEach((productOrder) => {
        productOrder.status = orderStatusEnums.find(
          (status) => status.value === productOrder.status.value
        );
      });
    });

    return res
      .status(200)
      .send({ data: orders.reverse(), message: "Orders fetched successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const getAuthVendorProductOrders = async (req, res) => {
  try {
    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    const shop = await ShopModel.findOne({ shopId: authUser.shopId }).lean();
    if (!shop) {
      return res.status(400).send({ error: "Shop not found" });
    }
    const productOrders = await ProductOrderModel.find({ shop: shop._id })
      .populate("product")
      .populate("user")
      .lean();
    // sort by createdAt in descending order
    productOrders.sort((a, b) => b.createdAt - a.createdAt);
    return res.status(200).send({
      data: productOrders,
      message: "Product Orders fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const getOrders = async (req, res) => {
  try {
    const orders = await OrderModel.find(req.query)

      .populate("user")
      .populate("productOrders")
      .lean();
    if (!orders) {
      return res.status(200).send({ data: [], message: "No orders found" });
    }
    orders.forEach((order) => {
      const progressValue = calcOrderProgress(order.productOrders);
      const progress = {
        value: progressValue?.toFixed(2),
        max: 100,
        min: 0,
      };
      order.progress = progress;
    });
    // sort by createdAt in descending order
    orders.sort((a, b) => b.createdAt - a.createdAt);

    return res
      .status(200)
      .send({ data: orders, message: "Orders fetched successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const getOrder = async (req, res) => {
  try {
    const { order_id } = req.query;
    if (!order_id) {
      return res.status(400).send({ error: "required order_id" });
    }
    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }

    const order = await OrderModel.findOne({ _id: order_id })
      .populate("productOrders")
      .populate("payment")
      .populate("user")
      .populate({
        path: "productOrders",
        populate: [
          { path: "product" },
          {
            path: "user",
          },
          {
            path: "shop",
          },
        ],
      })

      .lean();

    const user = order.user;
    const isAdmin = authUser.superAdmin || authUser.isAdmin;
    if (user._id.toString() !== authUser._id.toString() && !isAdmin) {
      return res
        .status(400)
        .send({ error: "You are not authorized to view this order" });
    }

    return res
      .status(200)
      .send({ data: order, message: "Order fetched successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const getOrderForReceipt = async (req, res) => {
  try {
    const { order_id } = req.query;
    if (!order_id) {
      return res.status(400).send({ error: "required order_id" });
    }

    const order = await OrderModel.findOne({ _id: order_id })
      .populate("productOrders")
      .populate("payment")
      .populate("user")
      .populate({
        path: "productOrders",
        populate: [
          { path: "product" },
          {
            path: "user",
          },
          {
            path: "shop",
          },
        ],
      })

      .lean();

    return res
      .status(200)
      .send({ data: order, message: "Order fetched successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const getOrderByOrderId = async (req, res) => {
  try {
    const { orderId } = req.query;
    if (!orderId) {
      return res.status(400).send({ error: "required orderId of order" });
    }
    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    const order = await OrderModel.findOne({ orderId })
      .populate("productOrders")
      .populate("payment")
      .populate("user")
      .populate({
        path: "productOrders",
        populate: [
          { path: "product" },
          {
            path: "user",
          },
          {
            path: "shop",
          },
        ],
      })

      .lean();
    const user = order.user;
    const isAdmin = authUser.superAdmin || authUser.isAdmin;
    if (user._id.toString() !== authUser._id.toString() && !isAdmin) {
      return res
        .status(400)
        .send({ error: "You are not authorized to view this order" });
    }

    const progressValue = calcOrderProgress(order.productOrders);
    const progress = {
      value: progressValue?.toFixed(2),
      max: 100,
      min: 0,
    };
    order.progress = progress;

    return res
      .status(200)
      .send({ data: order, message: "Order fetched successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const getProductOrders = async (req, res) => {
  try {
    const { status, shop } = req.query;

    const limit = parseInt(req.query.limit);
    const pageNumber = parseInt(req.query.pageNumber);
    if (!limit) {
      return res.status(400).send({ error: "required limit" });
    }
    if (!pageNumber) {
      return res.status(400).send({ error: "required pageNumber" });
    }

    const query = {
      ...(status && { "status.value": status }),
      ...(shop && { shop: mongoose.Types.ObjectId(shop) }),
    };

    const aggregate = [
      {
        $facet: {
          productOrders: [
            { $match: { ...query } },
            { $skip: limit * (pageNumber - 1) },
            { $limit: limit },
          ],
          totalCount: [{ $match: { ...query } }, { $count: "count" }],
        },
      },
    ];
    const productOrdersQuery = await ProductOrderModel.aggregate(
      aggregate
    ).exec();
    // populate user and product
    await ProductOrderModel.populate(productOrdersQuery[0].productOrders, {
      path: "product", // populate product
    });
    await ProductOrderModel.populate(productOrdersQuery[0].productOrders, {
      path: "shop", // populate shop
    });
    await ProductOrderModel.populate(productOrdersQuery[0].productOrders, {
      path: "user", // populate user
    });

    const productOrders = productOrdersQuery[0]?.productOrders;
    const totalCount = productOrdersQuery[0]?.totalCount[0]?.count;

    return res.status(200).send({
      data: { productOrders, totalCount },
      message: "Product Orders fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const isPermittedToViewProductOrder = ({ user, productOrder }) => {
  if (!user || !productOrder) return false;
  if (user?.isAdmin || user?.superAdmin) return true;
  if (productOrder.shop && productOrder.shop.shopId === user.shopId) {
    return true;
  }
  if (
    productOrder.user &&
    productOrder.user?._id?.toString() === user._id.toString()
  ) {
    return true;
  }
  return false;
};
const getProductOrder = async (req, res) => {
  try {
    const { productOrder_id } = req.query;
    if (!productOrder_id) {
      return res.status(400).send({ error: "required productOrder_id" });
    }
    const productOrder = await ProductOrderModel.findOne({
      _id: productOrder_id,
    })
      .populate("product")
      .populate("shop")
      .populate("user")

      .lean();
    if (!productOrder) {
      return res.status(200).send({
        data: null,
        message: "Product Order not found",
      });
    }

    // check if auth user is the owner of the product order or super admin or admin or the shop owner
    // if not, return error
    const authUser = req?.cachedUser || (await getAuthUser(req));

    if (!isPermittedToViewProductOrder({ user: authUser, productOrder })) {
      return res.status(200).send({
        data: null,
        error: "You are not authorized to view this product order",
      });
    }
    console.log("permitted");
    const order = await OrderModel.findOne({
      _id: productOrder.order,
    }).lean();

    const deliveryDetails = order.deliveryDetails;
    productOrder.order = order;
    productOrder.deliveryDetails = deliveryDetails;
    productOrder.status = orderStatusEnums.find(
      (status) => status.value === productOrder.status.value
    );

    return res.status(200).send({
      data: productOrder,
      message: "Product Order fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const getProductOrderStatusHistory = async (req, res) => {
  try {
    const { productOrder_id } = req.query;
    if (!productOrder_id) {
      return res.status(400).send({ error: "required productOrder_id" });
    }
    const productOrder = await ProductOrderModel.findOne({
      _id: productOrder_id,
    }).lean();
    if (!productOrder) {
      return res.status(400).send({
        error:
          "Product Order not found. Ensure you provide a valid sub productOrder_id",
      });
    }
    const statusOptions = orderStatusEnums;
    let status = productOrder.status;
    const isCancelled = productOrder.cancel?.isCancelled;
    if (isCancelled) {
      status = productOrder.cancel.lastStatusBeforeCancel;
    }
    const statusIndex = statusOptions.findIndex(
      (s) => s.value === status.value
    );
    const statusHistory = statusOptions.slice(0, statusIndex + 1);
    // add date only when value is placed or confirmed
    statusHistory.forEach((s) => {
      if (s.value === "order placed") {
        s.date = productOrder.createdAt;
      }
      if (s.value === "order confirmed") {
        s.date = productOrder.confirmedAt;
      }
      if (s.value === "order delivered") {
        s.date = productOrder.deliveryDate;
      }
    });
    if (isCancelled) {
      statusHistory.push({
        name: "Order Cancelled",
        value: "order cancelled",
        date: productOrder.cancel.cancelledAt,
      });
    }
    const currentStatus = productOrder.status;

    const nextStatusIndex =
      statusOptions.findIndex((s) => s.value === currentStatus.value) + 1;
    const nextStatus =
      currentStatus?.value !== "order delivered" && !isCancelled
        ? statusOptions[nextStatusIndex]
        : null;
    return res.status(200).send({
      data: { statusHistory, nextStatus, currentStatus },
      message: "Product Order Status History fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const getOrderStatusOptions = async (req, res) => {
  try {
    const statusOptions = orderStatusEnums;
    return res.status(200).send({
      data: statusOptions,
      message: "Order Status Options fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const updateProductOrderStatus = async (req, res) => {
  try {
    const { productOrder_id, status } = req.body;

    let deliveryDate = null;
    let deliveryCompany = null;
    let deliveryTrackingNumber = null;
    let deliveryTrackingLink = null;

    if (!productOrder_id) {
      return res.status(400).send({ error: "required productOrder_id" });
    }
    if (!status) {
      return res.status(400).send({ error: "required status" });
    }
    const selectedStatus = orderStatusEnums.find((s) => s.value === status);
    if (!selectedStatus) {
      return res.status(400).send({ error: "Invalid status" });
    }
    if (selectedStatus.value === "order cancelled") {
      return res
        .status(400)
        .send({ error: "You can't cancel an order using this endpoint" });
    }
    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    if (
      !selectedStatus?.sellerAction &&
      !authUser.superAdmin &&
      !authUser?.isAdmin
    ) {
      return res.status(400).send({
        error: `You are not authorized to update this order status to ${selectedStatus.name}`,
      });
    }
    const productOrder = await ProductOrderModel.findOne({
      _id: productOrder_id,
    })
      .populate("shop")
      .populate("product")
      .lean();

    if (!productOrder) {
      return res.status(400).send({ error: "Product Order not found" });
    }
    const shopid = productOrder.shop.shopId;

    if (
      authUser.shopId !== shopid &&
      !authUser.superAdmin &&
      !authUser.isAdmin
    ) {
      return res
        .status(400)
        .send({ error: "You are not authorized to update this product order" });
    }

    let confirmedAt = productOrder.confirmedAt;
    // if selected status is placed, update confirmedAt to null

    if (selectedStatus.value === "order confirmed") {
      confirmedAt = new Date();
      // const createdAt = productOrder.createdAt;
      // const productType = productOrder.product.productType;
      // const bespokes = ["bespokeCloth", "bespokeShoe"];
    }
    if (selectedStatus.value === "order placed") {
      confirmedAt = null;
    }
    if (selectedStatus.value === "order dispatched") {
      if (!req.body.deliveryCompany) {
        return res.status(400).send({ error: "required deliveryCompany" });
      }
      deliveryCompany = req.body.deliveryCompany;
      deliveryTrackingNumber = req.body.deliveryTrackingNumber;
      deliveryTrackingLink = req.body.deliveryTrackingLink;
    }
    // nullify delivery company, tracking number and tracking link if status comes before order dispatched
    // check if status comes before order dispatched
    const dispatchedStatus = orderStatusEnums.find(
      (s) => s.value === "order dispatched"
    );
    const dispatchedStatusIndex = orderStatusEnums.findIndex(
      (s) => s.value === dispatchedStatus.value
    );
    const selectedStatusIndex = orderStatusEnums.findIndex(
      (s) => s.value === selectedStatus.value
    );
    if (selectedStatusIndex < dispatchedStatusIndex) {
      deliveryCompany = null;
      deliveryTrackingNumber = null;
      deliveryTrackingLink = null;
    }
    const shopRevenue = productOrder.shopRevenue;
    if (selectedStatus.value === "order delivered") {
      if (!req.body.deliveryDate) {
        return res.status(400).send({ error: "required deliveryDate" });
      }
      deliveryDate = new Date(req.body.deliveryDate);
    }
    // nullify delivery date if status is not order delivered
    if (selectedStatus.value !== "order delivered") {
      deliveryDate = null;
      shopRevenue.status = "pending";
    }
    let cancel = productOrder.cancel;

    if (productOrder.status.value === "order cancelled") {
      cancel = null;
      shopRevenue.status = "cancelled";
    }

    if (shopRevenue.status === "cancelled") {
      shopRevenue.status = "pending";
    }
    const UpdatedProductOrder = await ProductOrderModel.findByIdAndUpdate(
      productOrder_id,
      {
        status: selectedStatus,
        confirmedAt,
        deliveryCompany,
        deliveryTrackingNumber,
        deliveryTrackingLink,
        deliveryDate,
        cancel,
        shopRevenue,
      },
      { new: true }
    );

    const user = productOrder.user;
    const title = "Order Status Update";
    let body = `Item no ${productOrder?.itemNo} in your order with order ID - ${productOrder.orderId} has been updated to ${selectedStatus.name}`;
    const image = productOrder.images[0].link;

    const userNotification = await notifyIndividualUser({
      user_id: user,
      title,
      body,
      image,
      data: {
        orderId: productOrder.orderId.toString(),
        itemNo: productOrder.itemNo.toString(),
        productOrder_id: productOrder._id.toString(),
        notificationType: "order",
        roleType: "buyer",
      },
    });

    const notificationParam = {
      title,
      body,
      image,
      isAdminPanel: false,
      user_id: user,
    };

    // for shop
    const shop_id = productOrder.shop.toString();
    if (shop_id) {
      if (selectedStatus.value === "order confirmed") {
        const expectedVendorCompletionDate =
          UpdatedProductOrder.expectedVendorCompletionDate;
        body = `You have successfully confirmed an order with order ID - ${productOrder.orderId} and item number - ${productOrder.itemNo}. This order is expected to be completed between ${expectedVendorCompletionDate.min} and ${expectedVendorCompletionDate.max}`;
      } else {
        body = `Order with order ID - ${productOrder.orderId} and item number - ${productOrder.itemNo} has been updated to ${selectedStatus.name}`;
      }

      const notifyShopParam = {
        shop_id,
        title,
        body,
        image,
        data: {
          orderId: productOrder.orderId,
          itemNo: productOrder.itemNo,
          productOrder_id: productOrder._id.toString(),
          notificationType: "order",
          roleType: "vendor",
        },
      };
      const notify = await notifyShop(notifyShopParam);
    }
    notificationParam.isAdminPanel = true;
    notificationParam.user_id = null;
    notificationParam.data = {
      orderId: productOrder.orderId,
      itemNo: productOrder.itemNo,
      productOrder_id: productOrder._id.toString(),
      notificationType: "order",
      roleType: "admin",
    };
    // change body for admin notification
    //
    notificationParam.body = `Item no ${productOrder?.itemNo}  in order with order ID - ${productOrder.orderId} has been updated to ${selectedStatus.name}`;
    body = `Item no ${productOrder?.itemNo}  in order with order ID - ${productOrder.orderId} has been updated to ${selectedStatus.name}`;

    const addAdminNotification = await addNotification(notificationParam);
    const pushAllAdmins = await sendPushAllAdmins(title, body, image);

    return res.status(200).send({ data: UpdatedProductOrder });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const cancelOrder = async (req, res) => {
  try {
    const { productOrder_id, reason, cancelledBy } = req.body;

    if (!productOrder_id) {
      return res
        .status(400)
        .send({ error: "required productOrder_id for the item" });
    }
    if (!reason) {
      return res.status(400).send({ error: "required reason" });
    }
    const cancelledByEnums = ["buyer", "seller", "admin", "system"];
    if (cancelledBy && !cancelledByEnums.includes(cancelledBy)) {
      return res.status(400).send({
        error: `cancelledBy must be one of the following: ${cancelledByEnums.join(
          ", "
        )}`,
      });
    }
    const productOrder = await ProductOrderModel.findOne({
      _id: productOrder_id,
    }).lean();
    if (!productOrder) {
      return res.status(400).send({ error: "Product Order not found" });
    }
    if (productOrder.status.value === "order cancelled") {
      return res.status(400).send({ error: "Product Order already cancelled" });
    }

    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (
      productOrder.status.value !== "order placed" &&
      productOrder.status.value !== "order confirmed" &&
      !authUser.superAdmin &&
      !authUser.isAdmin
    ) {
      return res.status(400).send({
        error:
          "You are not authorized to cancel this product order at the stage. Contact support",
      });
    }
    if (
      productOrder.user.toString() !== authUser._id.toString() &&
      !authUser.superAdmin &&
      !authUser.isAdmin
    ) {
      return res
        .status(400)
        .send({ error: "You are not authorized to cancel this product order" });
    }

    const cancelledStatus = orderStatusEnums.find(
      (s) => s.value === "order cancelled"
    );
    const cancel = {
      isCancelled: true,
      reason,
      cancelledAt: new Date(),
      lastStatusBeforeCancel: productOrder.status,
      cancelledBy: cancelledBy || "buyer",
    };
    const shopRevenue = productOrder.shopRevenue;
    shopRevenue.status = "cancelled";

    const updatedStatus = await ProductOrderModel.findOneAndUpdate(
      { _id: productOrder._id },
      { status: cancelledStatus, cancel, shopRevenue },
      { new: true }
    );
    const isRejectedBySeller = cancelledBy === "seller";
    const user = productOrder.user;
    const title = "Order Status Update";
    let body = `An item in your order with order ID - ${
      productOrder.orderId
    } with item number - ${productOrder.itemNo} has been ${
      isRejectedBySeller ? "rejected by the seller" : "cancelled"
    }`;
    const image = productOrder.images[0].link;

    const notificationParam = {
      title,
      body,
      image,
      data: {
        orderId: productOrder.orderId.toString(),
        itemNo: productOrder.itemNo?.toString(),
        productOrder_id: productOrder._id.toString(),
        notificationType: "order",
        roleType: "buyer",
      },
      isAdminPanel: false,
      user_id: user,
    };
    const userNotification = await notifyIndividualUser(notificationParam);

    notificationParam.isAdminPanel = true;
    notificationParam.user_id = null;
    body = `An item in order with order ID - ${
      productOrder.orderId
    } with item number - ${productOrder.itemNo} has been ${
      isRejectedBySeller ? "rejected by the seller" : "cancelled"
    }`;
    const addAdminNotification = await addNotification(notificationParam);
    const pushAllAdmins = await sendPushAllAdmins(title, body, image);
    const shop_id = productOrder.shop.toString();
    if (shop_id) {
      body = `Order with order ID - ${productOrder.orderId} and item number - ${
        productOrder.itemNo
      } has been ${isRejectedBySeller ? "rejected by you" : "cancelled"}`;
      const notifyShopParam = {
        shop_id,
        title,
        body,
        image,
        data: {
          orderId: productOrder.orderId,
          itemNo: productOrder.itemNo,
          productOrder_id: productOrder._id.toString(),
          notificationType: "order",
          roleType: "vendor",
        },
      };
      const notify = await notifyShop(notifyShopParam);
    }
    return res.status(200).send({
      data: updatedStatus,
      message: `Order Item ${
        isRejectedBySeller ? "Rejected" : "Cancelled"
      } successfully`,
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const rejectOrder = async (req, res) => {
  try {
    const { productOrder_id, reason } = req.body;

    if (!productOrder_id) {
      return res
        .status(400)
        .send({ error: "required productOrder_id for the item" });
    }
    if (!reason) {
      return res.status(400).send({ error: "required reason" });
    }

    const productOrder = await ProductOrderModel.findOne({
      _id: productOrder_id,
    }).lean();
    if (!productOrder) {
      return res.status(400).send({ error: "Product Order not found" });
    }
    if (productOrder.status.value === "order cancelled") {
      return res
        .status(400)
        .send({ error: "Product Order already cancelled or rejected" });
    }
    if (
      productOrder.status.value === "dispatched" ||
      productOrder.status.value === "delivered"
    ) {
      return res.status(400).send({
        error:
          "You cannot reject an order that has been dispatched or delivered. Contact support",
      });
    }

    const authUser = req?.cachedUser || (await getAuthUser(req));

    const shop = await ShopModel.findOne({ _id: productOrder.shop }).lean();
    if (authUser.shopId !== shop.shopId) {
      return res
        .status(400)
        .send({ error: "You are not authorized to reject this product order" });
    }

    const cancelledStatus = orderStatusEnums.find(
      (s) => s.value === "order cancelled"
    );
    const cancel = {
      isCancelled: true,
      reason,
      cancelledAt: new Date(),
      lastStatusBeforeCancel: productOrder.status,
      cancelledBy: "seller",
    };
    const shopRevenue = productOrder.shopRevenue;
    shopRevenue.status = "cancelled";

    const updatedStatus = await ProductOrderModel.findOneAndUpdate(
      { _id: productOrder._id },
      { status: cancelledStatus, cancel, shopRevenue },
      { new: true }
    );

    const user = productOrder.user;
    const title = "Order Status Update";
    let body = `An item in your order with order ID - ${productOrder.orderId} with item number - ${productOrder.itemNo} has been rejected by the seller`;
    const image = productOrder.images[0].link;

    const notificationParam = {
      title,
      body,
      image,
      data: {
        orderId: productOrder.orderId.toString(),
        itemNo: productOrder.itemNo?.toString(),
        productOrder_id: productOrder._id.toString(),
        notificationType: "order",
        roleType: "buyer",
      },
      isAdminPanel: false,
      user_id: user,
    };
    const userNotification = await notifyIndividualUser(notificationParam);

    notificationParam.isAdminPanel = true;
    notificationParam.user_id = null;
    body = `An item in order with order ID - ${productOrder.orderId} with item number - ${productOrder.itemNo} has been rejected by the seller`;
    const addAdminNotification = await addNotification(notificationParam);
    const pushAllAdmins = await sendPushAllAdmins(title, body, image);
    return res.status(200).send({
      data: updatedStatus,
      message: `Order Item Rejected successfully`,
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const downloadReciept = async (req, res) => {
  try {
    const { order_id, fileName, socketId } = req.body;

    if (!order_id) {
      return res.status(400).send({ error: "order_id is required" });
    }

    if (!socketId) {
      return res.status(400).send({ error: "Socket id is required" });
    }

    const io = req.app.get("io");
    const sockets = req.app.get("sockets");

    const thisSocketId = sockets[socketId];
    const socketInstance = io.to(thisSocketId);

    socketInstance.emit("downloadProgress", {
      progress: 10,
      status: "Getting ready...",
    });

    socketInstance.emit("downloadProgress", {
      progress: 20,
      status: "Getting receipt...",
    });

    const order = await OrderModel.findOne({ _id: order_id.toString() });

    if (!order) {
      return res.status(400).send({
        error:
          "Encountered an error while verifying receipt to be attached. Please try again later or contact support if this continues",
      });
    }

    let pdf;

    socketInstance.emit("downloadProgress", {
      progress: 50,
      status: "Generating PDF...",
    });
    const website_url = `${url}/${order_id}`;
    const onProgress = socketInstance
      ? ({ progress, status }) =>
          socketInstance.emit("downloadProgress", { progress, status })
      : null;
    const progressParams = {
      onProgress,
      eventName: "Receipt",
      startPercent: 60,
      endPercent: 90,
    };
    pdf = await generatePdf(
      {
        type: "url",
        website_url,
      },
      progressParams
    );

    const today = new Date();
    const pdfFilename = fileName
      ? `${fileName}.pdf`
      : `${type}-${id}-${today.getFullYear()}-${today.getMonth()}-${today.getDate()}.pdf`;

    socketInstance.emit("downloadProgress", {
      progress: 90,
      status: "Sending PDF...",
    });

    return res.status(200).send({
      pdf,
      fileName: pdfFilename,
      message: "Downloaded successfully",
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

module.exports = {
  createOrder,
  getAuthBuyerOrders,
  getAuthVendorProductOrders,
  getOrders,
  getProductOrders,
  getOrderStatusOptions,
  updateProductOrderStatus,
  getOrder,
  getOrderForReceipt,
  getOrderByOrderId,
  getProductOrder,
  getProductOrderStatusHistory,
  cancelOrder,
  rejectOrder,
  downloadReciept,
  sendProductOrdershopEmail,
};
