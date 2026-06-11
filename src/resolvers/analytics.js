const { orderStatusEnums, statusEnums } = require("../helpers/constants");
const BasketModel = require("../models/basket");
const OrderModel = require("../models/order");
const ProductOrderModel = require("../models/productOrder");
const ProductModel = require("../models/products");
const ReviewModel = require("../models/review");
const ShopModel = require("../models/shop");
const UserModel = require("../models/user");

const normalizePhoneNumber = (phone) => {
  if (!phone) return "";
  return phone.toString().replace(/\D/g, "");
};

const getProductStat = async (productOrders) => {
  const data = {};
  // count productSold by multiplying the length of productOrders by the quantity of each product
  const productSold = productOrders.reduce((acc, productOrder) => {
    const { quantity } = productOrder;
    acc += quantity;
    return acc;
  }, 0);
  data.productSold = productSold;

  // group productSold by day of the week and count each group amount

  // group productOrders by status.name and count each group
  const statusOptions = orderStatusEnums.map((status) => status.name);

  // convert statusOptions to object with default value of 0
  const statusOptionsObject = statusOptions.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});

  const ordersCountByStatus = productOrders.reduce(
    (acc, productOrder) => {
      const { status } = productOrder;

      if (!acc[status.name]) {
        acc[status.name] = 0;
      }
      acc[status.name] += 1;
      return acc;
    },
    {
      ...statusOptionsObject,
    },
  );

  data.ordersCountByStatus = ordersCountByStatus;
  const products = productOrders.map((productOrder) => productOrder.product);
  // group products by category.productGroup and count each group
  const productGroups = products.map(
    (product) => product.categories.productGroup,
  );
  const productGroupsCount = productGroups.reduce(
    (acc, productGroup) => {
      if (!acc[productGroup]) {
        acc[productGroup] = 0;
      }
      acc[productGroup] += 1;
      return acc;
    },
    {
      "Ready-Made": 0,
      Bespoke: 0,
    },
  );
  data.productGroupsCount = productGroupsCount;
  const shopRevenuesByPaymentStatus = productOrders.reduce(
    (acc, order) => {
      const { shopRevenue } = order;
      if (!shopRevenue) {
        return acc;
      }
      const status = shopRevenue.status;
      if (status !== "pending" && status !== "paid") {
        return acc;
      }
      const value = shopRevenue?.value || 0;
      if (!acc[status]) {
        acc[status].value = 0;
        acc[status].currency = "NGN";
      }
      acc[status].value += value;

      return acc;
    },
    {
      pending: {
        currency: "NGN",
        value: 0,
      },
      paid: {
        currency: "NGN",
        value: 0,
      },
    },
  );
  data.shopRevenuesByPaymentStatus = shopRevenuesByPaymentStatus;

  return data;
};

const getShopAnalytics = async (req, res) => {
  try {
    const { shopId } = req.query;
    if (!shopId) {
      return res.status(400).send({ error: "required shopId" });
    }
    const shop = await ShopModel.findOne({ shopId });
    if (!shop) {
      return res.status(400).send({ error: "Shop not found" });
    }
    // where status is not cancelled
    const productOrders = await ProductOrderModel.find({
      shop: shop._id,
      status: { $ne: "cancelled" },
    })
      .populate("product")
      .lean();
    const data = await getProductStat(productOrders);

    return res
      .status(200)
      .send({ data, message: "Shop Analytics fetched successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const getProductOrderAnalytics = async (req, res) => {
  try {
    const productOrders = await ProductOrderModel.find({
      status: { $ne: "cancelled" },
    })
      .populate("product")
      .lean();

    const data = await getProductStat(productOrders);

    return res.status(200).send({
      data,
      message: "General Product Analytics fetched successfully",
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const getProuctTypeLabel = (productType) => {
  if (productType === "readyMadeCloth") {
    return "Ready-Made Cloth";
  }
  if (productType === "readyMadeShoe") {
    return "Ready-Made Shoe";
  }
  if (productType === "accessory") {
    return "Accessory";
  }
  if (productType === "bespokeCloth") {
    return "Bespoke Cloth";
  }
  if (productType === "bespokeShoe") {
    return "Bespoke Shoe";
  }
  return "OTH";
};

const getOrderCountAnalytics = async (req, res) => {
  try {
    const data = {};
    // get count of all orders
    const orderCount = await OrderModel.countDocuments();
    data.order = {
      label: "Unit Orders",
      count: orderCount,
    };
    const basketCount = await BasketModel.countDocuments();
    data.basket = {
      label: "Baskets",
      count: basketCount,
    };

    return res.status(200).send({
      data,
      message: "Count Analytics fetched successfully",
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const getProductOrdersCountByDate = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    if (!fromDate || !toDate) {
      return res.status(400).send({ error: "fromDate and toDate is required" });
    }
    const from = new Date(fromDate);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setUTCHours(23, 59, 59, 999);
    const productOrdersCount = await ProductOrderModel.find({
      createdAt: { $gte: from, $lte: to },
    }).countDocuments();
    return res.status(200).send({
      data: productOrdersCount,
      message: "Product Orders Count fetched successfully",
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const getProductAnalytics = async (req, res) => {
  try {
    const data = {};
    const products = await ProductModel.find({}).lean();
    const productTypes = products.map((product) => product.productType);
    const productTypeCount = productTypes.reduce((acc, productType) => {
      if (!acc[productType]) {
        acc[productType] = 0;
      }
      acc[productType] += 1;
      return acc;
    }, {});
    const productTypeCountArray = Object.keys(productTypeCount).map((key) => {
      return {
        label: getProuctTypeLabel(key),
        count: productTypeCount[key],
      };
    });
    data.productType = productTypeCountArray;
    const totalProductCount = products.length;
    data.totalProductCount = totalProductCount;
    const productOrders = await ProductOrderModel.find()
      .populate("product")
      .lean();

    // get most ordered products

    const mostOrderedProducts = productOrders.reduce((acc, productOrder) => {
      const { product, quantity } = productOrder;
      if (!acc[product._id]) {
        acc[product._id] = quantity;
      }
      acc[product._id] += quantity;
      return acc;
    }, {});
    // arrange mostOrderedProducts in descending order
    const mostOrderedProductsArray = Object.keys(mostOrderedProducts)
      .map((key) => {
        return {
          product: products.find((p) => p._id.toString() === key),
          quantity: mostOrderedProducts[key],
        };
      })
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
    data.mostOrderedProducts = mostOrderedProductsArray;

    // products with most ratings
    const reviews = await ReviewModel.find(
      {},
      {
        productId: 1,
        rating: 1,
      },
    ).lean();
    const mostRatedProductIds = reviews.reduce((acc, review) => {
      const { productId, rating } = review;
      if (!acc[productId]) {
        acc[productId] = rating;
      }
      acc[productId] += rating;
      return acc;
    }, {});

    // arrange mostRatedProducts in descending order
    const mostRatedProductsArray = Object.keys(mostRatedProductIds)
      .map((key) => {
        return {
          product: key,
          rating: mostRatedProductIds[key],
        };
      })
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5);

    const mostRatedProducts = mostRatedProductsArray.map((product) => {
      const productDetails = products.find(
        (p) => p.productId === product.product,
      );
      return {
        product: productDetails,
        rating: product.rating,
      };
    });
    data.mostRatedProducts = mostRatedProducts;
    const statusEnumsObj = statusEnums.reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {});
    // count products by status
    const productStatus = products.map((product) => product.status);
    const productStatusCount = productStatus.reduce(
      (acc, status) => {
        if (!acc[status]) {
          acc[status] = 0;
        }
        acc[status] += 1;
        return acc;
      },
      {
        ...statusEnumsObj,
      },
    );
    const productStatusCountArray = Object.keys(productStatusCount).map(
      (key) => {
        return {
          label: key,
          count: productStatusCount[key],
        };
      },
    );
    data.productStatus = productStatusCountArray;
    return res.status(200).send({
      data,
      message: "Product Analytics fetched successfully",
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const getUsersShopCountAnalytics = async (req, res) => {
  try {
    const data = {};
    // get count of all users
    const users = await UserModel.find({});
    const guestUsers = users.filter((user) => user.isGuest);
    const signedUpUsers = users.filter((user) => !user.isGuest);
    data.signedUpUsers = {
      label: "Signed Up Users",
      count: signedUpUsers.length,
    };
    data.guestUsers = {
      label: "Guest Users",
      count: guestUsers.length,
    };
    data.allUsers = {
      label: "All Users",
      count: users.length,
    };
    const shopCount = await ShopModel.countDocuments();
    data.shop = {
      label: "Shops",
      count: shopCount,
    };
    return res.status(200).send({
      data,
      message: "Users Analytics fetched successfully",
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const getInstoreOrderAnalytics = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const limit = Math.min(parseInt(req.query.limit || "5", 10), 20);

    const from = fromDate ? new Date(fromDate) : new Date();
    if (!fromDate) {
      from.setDate(from.getDate() - 29);
    }
    from.setUTCHours(0, 0, 0, 0);

    const to = toDate ? new Date(toDate) : new Date();
    to.setUTCHours(23, 59, 59, 999);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).send({ error: "Invalid fromDate or toDate" });
    }
    if (from > to) {
      return res.status(400).send({ error: "fromDate cannot be after toDate" });
    }

    const orders = await OrderModel.find({
      channel: "in-store",
      createdAt: { $gte: from, $lte: to },
    })
      .populate("payment")
      .populate("salesAgent", "firstName lastName email")
      .lean();

    const orderIds = orders.map((order) => order._id);

    const productOrders = orderIds.length
      ? await ProductOrderModel.find({
          order: { $in: orderIds },
          channel: "in-store",
        })
          .populate("product", "title productId images")
          .lean()
      : [];

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((acc, order) => {
      const totalInMinorUnit = Number(order?.payment?.total || 0);
      return acc + totalInMinorUnit / 100;
    }, 0);

    const totalItemsSold = productOrders.reduce(
      (acc, item) => acc + (item?.quantity || 0),
      0,
    );

    const customerMap = {};
    orders.forEach((order) => {
      const normalizedPhone =
        order?.inStoreCustomerDetails?.phoneNormalized ||
        normalizePhoneNumber(order?.inStoreCustomerDetails?.phone);
      if (!normalizedPhone) return;
      customerMap[normalizedPhone] = (customerMap[normalizedPhone] || 0) + 1;
    });

    const uniqueCustomers = Object.keys(customerMap).length;
    const returningCustomers = Object.values(customerMap).filter(
      (count) => count > 1,
    ).length;

    const averageOrderValue = totalOrders ? totalRevenue / totalOrders : 0;

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setUTCHours(23, 59, 59, 999);

    const todayOrders = orders.filter(
      (order) => order.createdAt >= todayStart && order.createdAt <= todayEnd,
    );
    const todayRevenue = todayOrders.reduce((acc, order) => {
      const totalInMinorUnit = Number(order?.payment?.total || 0);
      return acc + totalInMinorUnit / 100;
    }, 0);

    const paymentMethodMap = {};
    orders.forEach((order) => {
      const method = order?.payment?.channel || "unknown";
      const amount = Number(order?.payment?.total || 0) / 100;
      if (!paymentMethodMap[method]) {
        paymentMethodMap[method] = { method, count: 0, revenue: 0 };
      }
      paymentMethodMap[method].count += 1;
      paymentMethodMap[method].revenue += amount;
    });

    const paymentMethods = Object.values(paymentMethodMap).sort(
      (a, b) => b.revenue - a.revenue,
    );

    const ordersTrendMap = {};
    orders.forEach((order) => {
      const date = new Date(order.createdAt).toISOString().split("T")[0];
      const amount = Number(order?.payment?.total || 0) / 100;
      if (!ordersTrendMap[date]) {
        ordersTrendMap[date] = { date, orders: 0, revenue: 0 };
      }
      ordersTrendMap[date].orders += 1;
      ordersTrendMap[date].revenue += amount;
    });
    const dailyTrend = Object.values(ordersTrendMap).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    const topProductsMap = {};
    productOrders.forEach((productOrder) => {
      const productId = productOrder?.product?._id?.toString();
      if (!productId) return;
      if (!topProductsMap[productId]) {
        topProductsMap[productId] = {
          productId,
          title: productOrder?.product?.title || "",
          quantity: 0,
          revenue: 0,
          image:
            productOrder?.images?.[0]?.link ||
            productOrder?.product?.images?.[0]?.link ||
            null,
        };
      }
      topProductsMap[productId].quantity += productOrder?.quantity || 0;
      const amountValue =
        productOrder?.amount?.find((a) => a.currency === "NGN")?.value || 0;
      topProductsMap[productId].revenue += amountValue;
    });
    const topProducts = Object.values(topProductsMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);

    const salesAgentsMap = {};
    orders.forEach((order) => {
      const id = order?.salesAgent?._id?.toString();
      if (!id) return;
      if (!salesAgentsMap[id]) {
        salesAgentsMap[id] = {
          salesAgentId: id,
          name: `${order.salesAgent?.firstName || ""} ${
            order.salesAgent?.lastName || ""
          }`.trim(),
          email: order.salesAgent?.email || null,
          orders: 0,
          revenue: 0,
        };
      }
      salesAgentsMap[id].orders += 1;
      salesAgentsMap[id].revenue += Number(order?.payment?.total || 0) / 100;
    });
    const topSalesAgents = Object.values(salesAgentsMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    const statusOptions = orderStatusEnums.map((status) => status.name);
    const statusDefaultObject = statusOptions.reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {});
    const ordersCountByStatus = productOrders.reduce(
      (acc, productOrder) => {
        const statusName = productOrder?.status?.name;
        if (!statusName) return acc;
        if (!acc[statusName]) {
          acc[statusName] = 0;
        }
        acc[statusName] += 1;
        return acc;
      },
      { ...statusDefaultObject },
    );

    return res.status(200).send({
      data: {
        range: {
          from,
          to,
        },
        overview: {
          totalOrders,
          totalRevenue,
          totalItemsSold,
          averageOrderValue,
          uniqueCustomers,
          returningCustomers,
        },
        today: {
          orders: todayOrders.length,
          revenue: todayRevenue,
        },
        ordersCountByStatus,
        paymentMethods,
        dailyTrend,
        topProducts,
        topSalesAgents,
      },
      message: "In-store order analytics fetched successfully",
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const getOnlineOrderAnalytics = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const limit = Math.min(parseInt(req.query.limit || "5", 10), 20);

    const from = fromDate ? new Date(fromDate) : new Date();
    if (!fromDate) {
      from.setDate(from.getDate() - 29);
    }
    from.setUTCHours(0, 0, 0, 0);

    const to = toDate ? new Date(toDate) : new Date();
    to.setUTCHours(23, 59, 59, 999);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).send({ error: "Invalid fromDate or toDate" });
    }
    if (from > to) {
      return res.status(400).send({ error: "fromDate cannot be after toDate" });
    }

    const orders = await OrderModel.find({
      // channel is not in-store
      channel: { $ne: "in-store" },
      createdAt: { $gte: from, $lte: to },
    })
      .populate("payment")
      .populate("user", "firstName lastName email")
      .lean();

    const orderIds = orders.map((order) => order._id);

    const productOrders = orderIds.length
      ? await ProductOrderModel.find({
          order: { $in: orderIds },
        })
          .populate("product", "title productId images categories productType")
          .populate("shop", "shopName shopId")
          .lean()
      : [];

    const totalOrders = orders.length;

    const totalRevenue = orders.reduce((acc, order) => {
      const totalInMinorUnit = Number(order?.payment?.total || 0);
      return acc + totalInMinorUnit / 100;
    }, 0);

    const totalItemsSold = productOrders.reduce(
      (acc, item) => acc + (item?.quantity || 0),
      0,
    );

    const averageOrderValue = totalOrders ? totalRevenue / totalOrders : 0;

    const uniqueCustomers = new Set(
      orders.map((o) => o?.user?._id?.toString()).filter(Boolean),
    ).size;

    // today
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setUTCHours(23, 59, 59, 999);

    const todayOrders = orders.filter(
      (order) => order.createdAt >= todayStart && order.createdAt <= todayEnd,
    );
    const todayRevenue = todayOrders.reduce((acc, order) => {
      return acc + Number(order?.payment?.total || 0) / 100;
    }, 0);

    // delivery method breakdown
    const deliveryMethodMap = {};
    orders.forEach((order) => {
      const method = order?.payment?.deliveryMethod || "standard";
      const amount = Number(order?.payment?.total || 0) / 100;
      if (!deliveryMethodMap[method]) {
        deliveryMethodMap[method] = { method, count: 0, revenue: 0 };
      }
      deliveryMethodMap[method].count += 1;
      deliveryMethodMap[method].revenue += amount;
    });
    const deliveryMethods = Object.values(deliveryMethodMap).sort(
      (a, b) => b.count - a.count,
    );

    // payment gateway breakdown
    const gatewayMap = {};
    orders.forEach((order) => {
      const gateway = order?.payment?.gateway || "unknown";
      const amount = Number(order?.payment?.total || 0) / 100;
      if (!gatewayMap[gateway]) {
        gatewayMap[gateway] = { gateway, count: 0, revenue: 0 };
      }
      gatewayMap[gateway].count += 1;
      gatewayMap[gateway].revenue += amount;
    });
    const paymentGateways = Object.values(gatewayMap).sort(
      (a, b) => b.revenue - a.revenue,
    );

    // currency breakdown
    const currencyMap = {};
    orders.forEach((order) => {
      const currency = order?.payment?.currency || "NGN";
      const amount = Number(order?.payment?.total || 0) / 100;
      if (!currencyMap[currency]) {
        currencyMap[currency] = { currency, count: 0, revenue: 0 };
      }
      currencyMap[currency].count += 1;
      currencyMap[currency].revenue += amount;
    });
    const currencyBreakdown = Object.values(currencyMap).sort(
      (a, b) => b.count - a.count,
    );

    // daily trend
    const ordersTrendMap = {};
    orders.forEach((order) => {
      const date = new Date(order.createdAt).toISOString().split("T")[0];
      const amount = Number(order?.payment?.total || 0) / 100;
      if (!ordersTrendMap[date]) {
        ordersTrendMap[date] = { date, orders: 0, revenue: 0 };
      }
      ordersTrendMap[date].orders += 1;
      ordersTrendMap[date].revenue += amount;
    });
    const dailyTrend = Object.values(ordersTrendMap).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    // top products
    const topProductsMap = {};
    productOrders.forEach((productOrder) => {
      const productId = productOrder?.product?._id?.toString();
      if (!productId) return;
      if (!topProductsMap[productId]) {
        topProductsMap[productId] = {
          productId,
          title: productOrder?.product?.title || "",
          productType: productOrder?.product?.productType || "",
          quantity: 0,
          revenue: 0,
          image: productOrder?.images?.[0]?.link || null,
        };
      }
      topProductsMap[productId].quantity += productOrder?.quantity || 0;
      const amountValue =
        productOrder?.amount?.find((a) => a.currency === "NGN")?.value || 0;
      topProductsMap[productId].revenue += amountValue;
    });
    const topProducts = Object.values(topProductsMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);

    // top shops by revenue
    const topShopsMap = {};
    productOrders.forEach((productOrder) => {
      const shopId = productOrder?.shop?._id?.toString();
      if (!shopId) return;
      if (!topShopsMap[shopId]) {
        topShopsMap[shopId] = {
          shopId,
          shopName: productOrder?.shop?.shopName || "",
          orders: 0,
          revenue: 0,
        };
      }
      topShopsMap[shopId].orders += 1;
      const amountValue =
        productOrder?.amount?.find((a) => a.currency === "NGN")?.value || 0;
      topShopsMap[shopId].revenue += amountValue;
    });
    const topShops = Object.values(topShopsMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    // orders by status
    const statusOptions = orderStatusEnums.map((status) => status.name);
    const statusDefaultObject = statusOptions.reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {});
    const ordersCountByStatus = productOrders.reduce(
      (acc, productOrder) => {
        const statusName = productOrder?.status?.name;
        if (!statusName) return acc;
        if (!acc[statusName]) acc[statusName] = 0;
        acc[statusName] += 1;
        return acc;
      },
      { ...statusDefaultObject },
    );

    return res.status(200).send({
      data: {
        range: { from, to },
        overview: {
          totalOrders,
          totalRevenue,
          totalItemsSold,
          averageOrderValue,
          uniqueCustomers,
        },
        today: {
          orders: todayOrders.length,
          revenue: todayRevenue,
        },
        ordersCountByStatus,
        deliveryMethods,
        paymentGateways,
        currencyBreakdown,
        dailyTrend,
        topProducts,
        topShops,
      },
      message: "Online order analytics fetched successfully",
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

module.exports = {
  getShopAnalytics,
  getProductOrderAnalytics,
  getOrderCountAnalytics,
  getProductOrdersCountByDate,
  getProductAnalytics,
  getUsersShopCountAnalytics,
  getInstoreOrderAnalytics,
  getOnlineOrderAnalytics,
};
