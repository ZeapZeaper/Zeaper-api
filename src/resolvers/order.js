const { orderStatusEnums } = require("../helpers/constants");
const { getAuthUser } = require("../middleware/firebaseUserAuth");
const BasketModel = require("../models/basket");
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
  replaceOrderVariablesinTemplate,
  calcShopRevenueValue,
  capitalizeFirstLetter,
  displayDate,
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
const PaymentModel = require("../models/payment");
const url =
  ENV === "prod"
    ? process.env.DOC_DOWNLOAD_URL_PROD
    : process.env.DOC_DOWNLOAD_URL_DEV;

function getRandomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const normalizePhoneNumber = (phone) => {
  if (!phone) return "";
  return phone.toString().replace(/\D/g, "");
};

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
      { lean: true },
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
      productOrder,
    );

  const formattedProductOrderTemplateSubject =
    replaceProductOrderVariablesinTemplate(
      replaceUserVariablesinTemplate(productOrderEmailTemplate?.subject, user),
      productOrder,
    );

  const emailParam = {
    from: "admin@zeaper.com",
    to: [email],
    subject: formattedProductOrderTemplateSubject || title,
    body: formattedProductOrderTemplateBody || body,
  };

  const sentEmail = await sendEmail(emailParam);
};
const buildBaseProductOrderData = ({ product, variation, index }) => {
  const itemNo = index + 1;

  const color = variation?.colorValue;
  const size = variation?.size;

  const images =
    product?.colors
      .find((c) => c.value == color)
      ?.images.map((img) => ({
        link: img.link,
        name: img.name,
      })) || [];

  return {
    itemNo,
    color,
    size,
    images,
  };
};
const buildProductOrdersInstore = async ({
  order,
  items, // use original items from calculateInstoreTotal
}) => {
  const productOrders = [];

  const productIds = items.map((i) => i.productId);

  const products = await ProductModel.find({
    productId: { $in: productIds },
  })
    .populate("shop")
    .lean();

  const productMap = {};
  products.forEach((p) => {
    productMap[p.productId] = p;
  });

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const product = productMap[item.productId];

    if (!product) {
      throw new Error(`Product not found: ${item.productId}`);
    }

    const variation = product.variations.find((v) => v.sku === item.sku);

    if (!variation) {
      throw new Error(`Invalid SKU: ${item.sku}`);
    }
    if (!item.lockedUnitPrice || item.lockedUnitPrice <= 0) {
      throw new Error("Invalid locked price");
    }

    const quantity = item.quantity;
    const unitPrice = item.lockedUnitPrice;
    const amountDue = unitPrice * quantity;

    const basePrice = variation.price;
    const discountApplied = variation.discount || variation.price;
    const originalAmountDue = basePrice || discountApplied * quantity;

    const shop = product.shop;
    const commission = shop?.commission;

    const baseData = buildBaseProductOrderData({
      order,
      product,
      variation,
      item,
      index,
    });
    const deliveredStatus = orderStatusEnums.find(
      (orderStatus) => orderStatus.value === "order delivered",
    );
    const productOrder = new ProductOrderModel({
      order: order._id,
      orderId: order.orderId,
      itemNo: baseData.itemNo,
      shop: shop?._id,
      product: product._id,
      quantity,
      sku: item.sku,
      barcode: variation.barcode || null,
      status: {
        name: deliveredStatus.name || "delivered",
        value: deliveredStatus.value || "order delivered",
      },
      // in-store orders are marked delivered immediately

      // ✅ actual charged price
      amount: [
        {
          currency: "NGN",
          value: amountDue,
        },
      ],
      channel: "in-store",
      pricing: {
        unitPrice,
        basePrice,
        discountApplied,
        pricingSource: "in-store",
      },
      color: baseData.color,
      size: baseData.size,
      images: baseData.images,

      // ✅ still based on vendor price
      shopRevenue: {
        currency: "NGN",
        status: "pending",
        value: calcShopRevenueValue({
          productType: product.productType,
          originalAmountDue,
          amountDue: originalAmountDue, // 👈 IMPORTANT
          commission,
          adminControlledDiscount: false,
        }),
      },
    });

    const saved = await productOrder.save();
    if (!saved) continue;

    productOrders.push(saved._id);
  }

  return { productOrders };
};
const buildOnlineProductOrders = async ({
  order,
  basketItems,
  currency,
  deliveryMethod,
  deliveryDetails,
}) => {
  const productOrders = [];
  const orderId = order.orderId;
  let defaultImage = null;
  const workerTasks = [];

  const promises = basketItems.map(async (item, index) => {
    const product = await ProductModel.findOne({ _id: item.product })
      .populate("shop")
      .lean();
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
    const unitPrice = variation.discount || variation.price;
    const originalAmountDue = variation?.price * quantity;
    const amountDue = unitPrice * quantity;

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
    const commission = shop?.commission;

    const productOrder = new ProductOrderModel({
      order: order._id,
      orderId,
      itemNo,
      shop: shop ? shop._id : null,
      product: item.product._id,
      quantity,
      sku,
      bespokeColor: item.bespokeColor,
      bespokeInstruction: item.bespokeInstruction,
      bodyMeasurements: item.bodyMeasurements,
      status: { name: "placed", value: "order placed" },
      amount,
      pricing: {
        unitPrice,
        basePrice: variation.price,
        discountApplied: variation.discount || variation.price,
        pricingSource: "online",
      },
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
          commission,
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

const createOrder = async ({
  payment,
  user,
  gainedPoints,
  passedItems,
  channel = "online",
  salesAgent,
  inStoreCustomerDetails,
}) => {
  try {
    let basket = null;
    let deliveryDetails = null;
    let basketItems = passedItems;

    if (!passedItems) {
      basket = await BasketModel.findOne({ _id: payment.basket }).lean();
      if (!basket) return { error: "Basket not found" };

      basketItems = basket.basketItems;
      deliveryDetails = basket.deliveryDetails;

      if (!deliveryDetails) return { error: "Delivery details not found" };
    }

    const orderId = await generateUniqueOrderId();

    const order = new OrderModel({
      orderId,
      user,
      salesAgent,
      basket: basket?._id,
      deliveryDetails,
      payment: payment._id,
      gainedPoints, // handled by worker
      channel: channel || "online",
      inStoreCustomerDetails,
    });

    const savedOrder = await order.save();

    if (!savedOrder?._id) return { error: "Order not created" };

    const currency = payment.currency;
    const deliveryMethod = payment?.deliveryMethod;

    let buildResult;

    if (channel === "in-store") {
      buildResult = await buildProductOrdersInstore({
        order: savedOrder,
        items: passedItems,
      });
    } else {
      buildResult = await buildOnlineProductOrders({
        savedOrder,
        basketItems,
        currency,
        deliveryMethod,
        deliveryDetails,
        channel,
      });
    }

    const { productOrders, defaultImage, workerTasks = [] } = buildResult;

    if (!productOrders.length) return { error: "Product orders not created" };

    const updatedOrder = await OrderModel.findOneAndUpdate(
      { _id: savedOrder._id },
      { productOrders },
      { new: true },
    );

    // update variation quantities
    await updateVariationQuantity(basketItems, "subtract");

    // delete basket
    if (basket) {
      await BasketModel.findOneAndDelete({ _id: basket._id });
    }
    // ================= add order-level worker tasks =================
    if (channel === "online") {
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
      // add updateBuyerHasOrders as worker task to update buyer
      workerTasks.push({
        taskType: "updateBuyerHasOrders",
        user_id: user,
        orderId,
      });
      updatedOrder.defaultImage = defaultImage;
    }
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
      const _id = item.product;
      const product = await ProductModel.findOne({
        _id,
      }).lean();
      if (!product) {
        return;
      }

      const variations = product.variations;
      const variation = variations.find(
        (variation) => variation.sku === item.sku,
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
            "variations.$.quantity": newQuantity < 0 ? 0 : newQuantity,
          },
        },
      );
    });
    resolve(true);
  });
};

const getProductOrderPercentage = (allocatedPercentage, productOrder) => {
  const status = orderStatusEnums?.find(
    (status) => status.value === productOrder?.status?.value,
  );
  if (!status) return 0;
  // allocatedPercentage is the percentage of the item in the overall order
  const statusPercentage = status?.percentage || 0;
  const productOrderPercentage = (allocatedPercentage / 100) * statusPercentage;
  return productOrderPercentage;
};
const calcOrderProgress = (productOrders) => {
  const total = productOrders?.filter(
    (productOrder) => productOrder?.status?.value !== "order cancelled",
  ).length;
  return productOrders?.reduce((acc, productOrder) => {
    const allocatedPercentage = 100 / total;
    const productOrderPercentage = getProductOrderPercentage(
      allocatedPercentage,
      productOrder,
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
          (status) => status.value === productOrder.status.value,
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
      .populate("salesAgent")
      .populate({
        path: "productOrders",
        populate: [
          { path: "product" },

          {
            path: "shop",
          },
        ],
      })

      .lean();

    const user = order?.user;
    const isAdmin = authUser.superAdmin || authUser.isAdmin;
    if (user?._id.toString() !== authUser._id.toString() && !isAdmin) {
      return res
        .status(400)
        .send({ error: "You are not authorized to view this order" });
    }
    if (!order?.user && order?.inStoreCustomerDetails) {
      const { fullName, email, phone } = order.inStoreCustomerDetails;
      const firstName = fullName?.split(" ")[0] || "";
      const lastName = fullName?.split(" ")[1] || "";
      order.user = {
        ...(email && { email }),
        ...(phone && { phone }),
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
      };
    }
    order.productOrders.forEach((productOrder) => {
      productOrder.user = order.user;
    });

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
    if (!order) {
      return res.status(400).send({ error: "Order not found" });
    }
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
    const productOrdersQuery =
      await ProductOrderModel.aggregate(aggregate).exec();
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
      .populate("order")

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

    const order = productOrder.order;

    const deliveryDetails = order.deliveryDetails;
    productOrder.deliveryDetails = deliveryDetails;
    productOrder.status = orderStatusEnums.find(
      (status) => status.value === productOrder.status.value,
    );
    if (!productOrder?.user && order?.inStoreCustomerDetails) {
      const { fullName, email, phone } = order.inStoreCustomerDetails;
      const firstName = fullName?.split(" ")[0] || "";
      const lastName = fullName?.split(" ")[1] || "";
      productOrder.user = {
        ...(email && { email }),
        ...(phone && { phone }),
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
      };
    }
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
      (s) => s.value === status.value,
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

    const authUser = req.cachedUser || (await getAuthUser(req));
    if (!authUser) {
      return res.status(401).send({ error: "User not found" });
    }

    if (
      !selectedStatus.sellerAction &&
      !authUser.superAdmin &&
      !authUser.isAdmin
    ) {
      return res.status(403).send({
        error: `You are not authorized to update status to ${selectedStatus.name}`,
      });
    }

    const productOrder = await ProductOrderModel.findById(productOrder_id)
      .populate("product")
      .populate("shop")
      .lean();

    if (!productOrder) {
      return res.status(404).send({ error: "Product order not found" });
    }

    const { shop, status: currentStatus, shopRevenue } = productOrder;
    const shopId = shop?.shopId;
    const shop_id = shop?._id;

    if (
      authUser.shopId !== shopId &&
      !authUser.superAdmin &&
      !authUser.isAdmin
    ) {
      return res
        .status(403)
        .send({ error: "You are not authorized to update this product order" });
    }

    if (currentStatus.value === "order delivered") {
      return res
        .status(400)
        .send({ error: "Delivered orders cannot be updated" });
    }

    if (currentStatus.value === "order cancelled") {
      const cancelledBy = productOrder.cancel?.cancelledBy || "buyer";
      return res.status(400).send({
        error: `This order was already cancelled by ${capitalizeFirstLetter(
          cancelledBy,
        )}`,
      });
    }

    /* ---------------- Status-based updates ---------------- */

    let confirmedAt = productOrder.confirmedAt;
    let deliveryCompany = null;
    let deliveryTrackingNumber = null;
    let deliveryTrackingLink = null;
    let deliveryDate = null;
    let cancel = productOrder.cancel;

    if (selectedStatus.value === "order confirmed") {
      confirmedAt = new Date();
    }

    if (selectedStatus.value === "order placed") {
      confirmedAt = null;
    }

    if (selectedStatus.value === "order dispatched") {
      const {
        deliveryCompany: dc,
        deliveryTrackingNumber: dtn,
        deliveryTrackingLink: dtl,
      } = req.body;

      if (!dc) {
        return res.status(400).send({ error: "required deliveryCompany" });
      }

      deliveryCompany = dc;
      deliveryTrackingNumber = dtn || null;
      deliveryTrackingLink = dtl || null;
    }

    const dispatchedIndex = orderStatusEnums.findIndex(
      (s) => s.value === "order dispatched",
    );
    const selectedIndex = orderStatusEnums.findIndex(
      (s) => s.value === selectedStatus.value,
    );

    if (selectedIndex < dispatchedIndex) {
      deliveryCompany = null;
      deliveryTrackingNumber = null;
      deliveryTrackingLink = null;
    }

    if (selectedStatus.value === "order delivered") {
      if (!req.body.deliveryDate) {
        return res.status(400).send({ error: "required deliveryDate" });
      }
      deliveryDate = new Date(req.body.deliveryDate);
      shopRevenue.status = "completed";
    } else {
      deliveryDate = null;
      shopRevenue.status = "pending";
    }

    /* ---------------- Update DB ---------------- */

    const updatedProductOrder = await ProductOrderModel.findByIdAndUpdate(
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
      { new: true },
    );

    /* ---------------- Notifications ---------------- */

    const user = productOrder.user;
    const image = productOrder.images?.[0]?.link;

    const buyerBody = `Item no ${productOrder.itemNo} in your order ${productOrder.orderId} has been updated to ${selectedStatus.name}`;

    await notifyIndividualUser({
      user_id: user,
      title: "Order Status Update",
      body: buyerBody,
      image,
      data: {
        orderId: productOrder.orderId.toString(),
        itemNo: productOrder.itemNo.toString(),
        productOrder_id: productOrder._id.toString(),
        notificationType: "order",
        roleType: "buyer",
      },
    });

    if (shop_id) {
      let vendorBody = `Order ${productOrder.orderId}, item ${productOrder.itemNo} updated to ${selectedStatus.name}`;

      if (selectedStatus.value === "order confirmed") {
        const { min, max } = updatedProductOrder.expectedVendorCompletionDate;
        vendorBody = `Order ${
          productOrder.orderId
        } confirmed. Expected completion between ${displayDate(
          min,
          false,
        )} and ${displayDate(max, false)}`;
      }

      await notifyShop({
        shop_id,
        title: "Order Status Update",
        body: vendorBody,
        image,
        data: {
          orderId: productOrder.orderId,
          itemNo: productOrder.itemNo.toString(),
          productOrder_id: productOrder._id.toString(),
          notificationType: "order",
          roleType: "vendor",
        },
      });
    }

    const adminBody = `Item ${productOrder.itemNo} in order ${
      productOrder.orderId
    } updated to ${selectedStatus.name} by ${
      authUser.shopId === shopId ? "Vendor" : "Admin"
    }`;

    const adminNotification = {
      title: "Order Status Update",
      body: adminBody,
      image,
      isAdminPanel: true,
      user_id: null,
      data: {
        orderId: productOrder.orderId,
        itemNo: productOrder.itemNo.toString(),
        productOrder_id: productOrder._id.toString(),
        notificationType: "order",
        roleType: "admin",
      },
    };

    await addNotification(adminNotification);
    await sendPushAllAdmins(adminNotification);

    return res.status(200).send({ data: updatedProductOrder });
  } catch (error) {
    return res.status(500).send({ error: error.message });
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
          ", ",
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
      (s) => s.value === "order cancelled",
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
      { new: true },
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
      productOrder.status.value === "order ready for delivery" ||
      productOrder.status.value === "dispatched" ||
      productOrder.status.value === "delivered"
    ) {
      return res.status(400).send({
        error: "You cannot reject an order at this stage. Contact support",
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
      (s) => s.value === "order cancelled",
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
      { new: true },
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
      progressParams,
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

const calculateInstoreTotal = async ({ items, currency = "NGN" }) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error("Items are required");
  }

  const productIds = items.map((i) => i.productId);
  const products = await ProductModel.find({
    productId: { $in: productIds },
  })
    .select("title variations productId")
    .lean();

  const productMap = {};
  products.forEach((p) => {
    productMap[p.productId] = p;
  });

  let itemsTotal = 0;
  const detailedItems = [];

  for (const item of items) {
    const { productId, sku, quantity } = item;

    if (!productId || !sku || !quantity) {
      throw new Error("Each item must have productId, sku, and quantity");
    }

    const product = productMap[productId];
    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    const variation = product.variations.find((v) => v.sku === sku);
    if (!variation) {
      throw new Error(`Invalid SKU for product: ${product.title}`);
    }

    if (variation.bespoke?.isBespoke) {
      throw new Error(
        `Bespoke products are not available for in-store purchase: ${product.title} (SKU: ${sku})`,
      );
    }
    if (variation.quantity < quantity) {
      throw new Error(
        `Insufficient stock for ${product.title} (SKU: ${sku}). Available: ${variation.quantity}`,
      );
    }
    const instorePrice = variation.instorePrice;
    if (!instorePrice) {
      throw new Error(
        `In-store price not set for ${product.title} (SKU: ${sku}). This is likely not available for in-store purchase. Please check your product settings or contact support.`,
      );
    }
    const unitPrice = instorePrice;
    const totalPrice = unitPrice * quantity;

    itemsTotal += totalPrice;

    detailedItems.push({
      productId,
      product: product._id,
      title: product.title,
      sku,
      quantity,
      unitPrice,
      totalPrice,
      status: "available",
    });
  }

  return {
    currency,
    itemsTotal,
    items: detailedItems,
  };
};

const getInstoreOrderTotal = async (req, res) => {
  try {
    const { items, currency = "NGN" } = req.query;
    if (!items) {
      return res.status(400).send({ error: "Items are required" });
    }
    //convert items from string to array
    let parsedItems;
    try {
      parsedItems = JSON.parse(items);
    } catch (error) {
      return res.status(400).send({ error: "Invalid items format" });
    }
    const result = await calculateInstoreTotal({
      items: parsedItems,
      currency,
    });

    let convertedTotal = result.itemsTotal;

    if (currency !== "NGN") {
      convertedTotal = await currencyConversion(result.itemsTotal, currency);
    }

    return res.status(200).send({
      data: {
        currency,
        itemsTotal: convertedTotal,
        baseCurrencyTotal: result.itemsTotal,
        items: result.items,
      },
      message: "In-store total calculated successfully",
    });
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
};

const createInstoreOrder = async (req, res) => {
  try {
    const {
      items,
      paymentChannel, // "bank_transfer" | "pos_terminal"
      inStoreCustomerDetails,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).send({ error: "Items are required" });
    }

    if (!paymentChannel) {
      return res.status(400).send({ error: "paymentChannel is required" });
    }
    const customerFullName =
      inStoreCustomerDetails?.fullName?.toString().trim() || "Instore Guest";
    const customerPhone = inStoreCustomerDetails?.phone
      ? inStoreCustomerDetails.phone.toString().trim()
      : null;
    const normalizedPhone = customerPhone
      ? normalizePhoneNumber(customerPhone)
      : null;
    if (customerPhone && !normalizedPhone) {
      return res.status(400).send({ error: "Invalid customer phone" });
    }
    const customerEmail = inStoreCustomerDetails?.email || null;
    const sanitizedInStoreCustomerDetails = {
      ...(inStoreCustomerDetails || {}),
      fullName: customerFullName,
      email: customerEmail,
      phone: customerPhone,
      phoneNormalized: normalizedPhone,
    };
    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (!authUser) {
      return res.status(400).send({ error: "Auth user not found" });
    }
    if (paymentChannel !== "bank_transfer" && paymentChannel !== "pos") {
      return res.status(400).send({
        error: "Invalid payment channel. Must be 'bank_transfer' or 'pos'",
      });
    }
    // check if auth user is admin or super admin or sales agent
    if (
      !authUser.superAdmin &&
      !authUser.isAdmin &&
      authUser.role !== "sales_agent"
    ) {
      return res
        .status(403)
        .send({ error: "You are not authorized to create in-store orders" });
    }
    // ✅ 1. Calculate & VALIDATE total (includes stock check)
    const totalData = await calculateInstoreTotal({ items });

    // ✅ 2. Create offline payment
    const reference = `POS-${Date.now()}`;

    const payment = new PaymentModel({
      reference,
      orderSource: "in-store",
      salesAgent: authUser._id,
      fullName: customerFullName,
      email: customerEmail,
      status: "success",
      currency: "NGN",
      amount: totalData.itemsTotal * 100, // kobo
      total: totalData.itemsTotal * 100,
      itemsTotal: totalData.itemsTotal * 100,
      gateway: "offline",
      channel: paymentChannel,
      paidAt: new Date(),
      gatewayResponse: "Payment recorded as successful for in-store order",
    });

    const savedPayment = await payment.save();

    const basketItems = totalData.items.map((item) => ({
      product: item.product,
      productId: item.productId,
      quantity: item.quantity,
      sku: item.sku,
      lockedUnitPrice: item.unitPrice,
    }));

    // ✅ 4. Create order using existing system
    const orderResult = await createOrder({
      payment: savedPayment,
      salesAgent: authUser._id,
      gainedPoints: 0,
      channel: "in-store",
      passedItems: basketItems,
      inStoreCustomerDetails: sanitizedInStoreCustomerDetails,
    });

    if (orderResult.error) {
      return res.status(400).send({ error: orderResult.error });
    }

    const order = orderResult.order;

    // ✅ 5. Attach in-store specific data
    await OrderModel.findByIdAndUpdate(order._id, {
      channel: "in-store",
      inStoreCustomerDetails: sanitizedInStoreCustomerDetails,
      salesAgent: authUser._id,
      storeLocation: "Lagos",
      summary: {
        totalAmount: totalData.itemsTotal,
        currency: "NGN",
        itemsCount: items.length,
      },
    });

    // ✅ 6. Fetch complete order with all populated fields (for receipt)
    const completeOrder = await OrderModel.findOne({ _id: order._id })
      .populate("productOrders")
      .populate("payment")
      .populate("user")
      .populate({
        path: "productOrders",
        populate: [{ path: "product" }, { path: "user" }, { path: "shop" }],
      })
      .lean();

    return res.status(200).send({
      data: completeOrder,
      message: "In-store order created successfully",
    });
  } catch (error) {
    console.error("createInstoreOrder error:", error);
    return res.status(500).send({ error: error.message });
  }
};
const getInstoreCustomers = async (req, res) => {
  try {
    const authUser = req?.cachedUser || (await getAuthUser(req));
    if (!authUser) {
      return res.status(401).send({ error: "User not found" });
    }
    if (
      !authUser.superAdmin &&
      !authUser.isAdmin &&
      authUser.role !== "sales_agent"
    ) {
      return res
        .status(403)
        .send({ error: "You are not authorized to view in-store customers" });
    }

    const { search } = req.query;
    const normalizedSearchPhone = normalizePhoneNumber(search);

    const matchStage = {
      channel: "in-store",
      "inStoreCustomerDetails.phone": { $exists: true, $nin: [null, ""] },
    };
    if (search) {
      matchStage.$or = [
        {
          "inStoreCustomerDetails.fullName": { $regex: search, $options: "i" },
        },
        { "inStoreCustomerDetails.phone": { $regex: search, $options: "i" } },
      ];
    }

    const aggregatePipeline = [
      { $match: matchStage },
      {
        $addFields: {
          normalizedPhone: {
            $ifNull: [
              "$inStoreCustomerDetails.phoneNormalized",
              {
                $replaceAll: {
                  input: {
                    $replaceAll: {
                      input: {
                        $replaceAll: {
                          input: {
                            $replaceAll: {
                              input: {
                                $replaceAll: {
                                  input: {
                                    $toString: "$inStoreCustomerDetails.phone",
                                  },
                                  find: " ",
                                  replacement: "",
                                },
                              },
                              find: "-",
                              replacement: "",
                            },
                          },
                          find: "(",
                          replacement: "",
                        },
                      },
                      find: ")",
                      replacement: "",
                    },
                  },
                  find: "+",
                  replacement: "",
                },
              },
            ],
          },
        },
      },
      { $match: { normalizedPhone: { $ne: "" } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$normalizedPhone",
          fullName: { $first: "$inStoreCustomerDetails.fullName" },
          email: { $first: "$inStoreCustomerDetails.email" },
          phone: { $first: "$inStoreCustomerDetails.phone" },
          phoneNormalized: { $first: "$normalizedPhone" },
          address: { $first: "$inStoreCustomerDetails.address" },
          region: { $first: "$inStoreCustomerDetails.region" },
          country: { $first: "$inStoreCustomerDetails.country" },
          orderCount: { $sum: 1 },
          lastOrderAt: { $max: "$createdAt" },
          firstOrderAt: { $min: "$createdAt" },
        },
      },
      { $sort: { lastOrderAt: -1 } },
    ];

    if (normalizedSearchPhone) {
      aggregatePipeline.push({
        $match: {
          phoneNormalized: { $regex: normalizedSearchPhone, $options: "i" },
        },
      });
    }

    const customers = await OrderModel.aggregate(aggregatePipeline);
    customers.forEach((customer) => {
      customer.firstName = customer.fullName?.split(" ")[0] || "";
      customer.lastName = customer.fullName
        ? customer.fullName.split(" ").slice(1).join(" ")
        : "";
    });

    return res.status(200).send({
      data: customers,
      message: "In-store customers fetched successfully",
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const sendOrderReceiptEmail = async (req, res) => {
  try {
    const { email, order_id } = req.body;

    if (!email) {
      return res.status(400).send({ error: "email is required" });
    }
    if (!order_id) {
      return res.status(400).send({ error: "order_id is required" });
    }

    const order = await OrderModel.findOne({ _id: order_id })
      .populate("productOrders")
      .populate("payment")
      .populate("user")
      .populate({
        path: "productOrders",
        populate: [{ path: "product" }, { path: "shop" }],
      })
      .lean();

    if (!order) {
      return res.status(404).send({ error: "Order not found" });
    }

    // Build user object — prefer populated user, fall back to inStoreCustomerDetails
    let user = order.user;
    if (!user && order.inStoreCustomerDetails) {
      const {
        fullName,
        email: customerEmail,
        phone,
      } = order.inStoreCustomerDetails;
      const [firstName = "", ...rest] = (fullName || "").split(" ");
      const lastName = rest.join(" ");
      user = {
        firstName,
        lastName,
        ...(customerEmail && { email: customerEmail }),
        ...(phone && { phone }),
      };
    }

    const orderEmailTemplate = await EmailTemplateModel.findOne({
      name: "in-store-order",
    }).lean();

    const emailBody = replaceOrderVariablesinTemplate(
      replaceUserVariablesinTemplate(orderEmailTemplate?.body, user),
      order,
    );

    const emailSubject = replaceOrderVariablesinTemplate(
      replaceUserVariablesinTemplate(orderEmailTemplate?.subject, user),
      order,
    );

    await sendEmail({
      from: "admin@zeaper.com",
      to: [email],
      subject: emailSubject || "Order Successful",
      body: emailBody || "",
      attach: true,
      order_id,
    });

    return res.status(200).send({ message: "Order receipt sent successfully" });
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
  getInstoreOrderTotal,
  createInstoreOrder,
  getInstoreCustomers,
  sendOrderReceiptEmail,
};
