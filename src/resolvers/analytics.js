const { orderStatusEnums, statusEnums } = require("../helpers/constants");
const BasketModel = require("../models/basket");
const OrderModel = require("../models/order");
const ProductOrderModel = require("../models/productOrder");
const ProductModel = require("../models/products");
const ReviewModel = require("../models/review");
const ShopModel = require("../models/shop");
const UserModel = require("../models/user");

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
    }
  );

  data.ordersCountByStatus = ordersCountByStatus;
  const products = productOrders.map((productOrder) => productOrder.product);
  // group products by category.productGroup and count each group
  const productGroups = products.map(
    (product) => product.categories.productGroup
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
    }
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
    }
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
      }
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
        (p) => p.productId === product.product
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
      }
    );
    const productStatusCountArray = Object.keys(productStatusCount).map(
      (key) => {
        return {
          label: key,
          count: productStatusCount[key],
        };
      }
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
    data.user = {
      label: "Users",
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

module.exports = {
  getShopAnalytics,
  getProductOrderAnalytics,
  getOrderCountAnalytics,
  getProductOrdersCountByDate,
  getProductAnalytics,
  getUsersShopCountAnalytics,
};
