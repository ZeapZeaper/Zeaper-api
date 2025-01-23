const { orderStatusEnums } = require("../helpers/constants");
const BasketModel = require("../models/basket");
const OrderModel = require("../models/order");
const ProductOrderModel = require("../models/productOrder");
const ProductModel = require("../models/products");
const ShopModel = require("../models/shop");

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
  const orderPaymentsPaidToShop = productOrders.filter(
    (order) => order.shopRevenue.status === "paid"
  );

  const shopRevenuesByPaymentStatus = orderPaymentsPaidToShop.reduce(
    (acc, order) => {
      const { shopRevenue } = order;
      const status = shopRevenue.status;
      const value = shopRevenue.value;
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

const getGeneralProductAnalytics = async (req, res) => {
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

const getCountAnalytics = async (req, res) => {
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
    const products = await ProductModel.find().select("productType");
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
    return res.status(200).send({
      data,
      message: "Count Analytics fetched successfully",
    });
    
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

module.exports = {
  getShopAnalytics,
  getGeneralProductAnalytics,
  getCountAnalytics,
};
