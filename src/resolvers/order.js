const { isCancel } = require("axios");
const { orderStatusEnums } = require("../helpers/constants");
const { getAuthUser } = require("../middleware/firebaseUserAuth");
const BasketModel = require("../models/basket");
const DeliveryAddressModel = require("../models/deliveryAddresses");
const OrderModel = require("../models/order");
const ProductOrderModel = require("../models/productOrder");
const ProductModel = require("../models/products");
const ShopModel = require("../models/shop");
const { currencyCoversion } = require("../helpers/utils");

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

const buildProductOrders = async (order, basketItems, currency) => {
  const productOrders = [];
  const orderId = order.orderId;

  const promises = basketItems.map(async (item, index) => {
    const product = await ProductModel.findOne({
      _id: item.product,
    }).lean();
    if (!product) {
      return;
    }
    const shop = product.shop;

    const itemNo = index + 1;
    const quantity = item.quantity;
    const sku = item.sku;
    const bespokeColor = item.bespokeColor;
    const bodyMeasurements = item.bodyMeasurements;
    const bespokeInstruction = item.bespokeInstruction;
    const status = {
      name: "placed",
      value: "order placed",
    };
    const promo = product.promo;
    const variation = product.variations.find((v) => v.sku === sku);
    const amountDue = (variation?.discount || variation.price) * quantity;
    const amount = [
      {
        currency: "NGN",
        value: amountDue,
      },
    ];
    if (currency === "USD") {
      amount.push({
        currency: "USD",
        value: currencyCoversion(amountDue, "USD"),
      });
    }
    if (currency === "GBP") {
      amount.push({
        currency: "GBP",
        value: currencyCoversion(amountDue, "GBP"),
      });
    }

    const productOrder = new ProductOrderModel({
      order: order._id,
      orderId,
      itemNo,
      shop,
      product: item.product._id,
      quantity,
      sku,
      bespokeColor,
      bespokeInstruction,
      bodyMeasurements,
      status,
      amount,
      promo,
    });

    const savedProductOrder = await productOrder.save();

    productOrders.push(savedProductOrder._id);
  });

  await Promise.all(promises);
  return productOrders;
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

const createOrder = async (param) => {
  const { payment, user } = param;
  const basket = await BasketModel.findOne({
    _id: payment.basket,
  }).lean();
  if (!basket) {
    return {
      error: "Payment successful but basket not found. Please contact support",
    };
  }
  const deliveryAddress = DeliveryAddressModel.findOne({
    _id: basket?.deliveryAddress,
    user: user,
  }).lean();
  if (!deliveryAddress) {
    return {
      error:
        "Payment successful but delivery address not found. Hence, unable to proceed with order. Please contact support",
    };
  }
  const basketItems = basket.basketItems;

  const orderId = await generateUniqueOrderId();
  const order = new OrderModel({
    orderId,
    user: user,
    basket: basket?._id,
    deliveryAddress: basket?.deliveryAddress,
    payment: payment?._id,
  });

  const savedOrder = await order.save();
  if (!savedOrder?._id) {
    return {
      error: "Payment successful but order not created. Please contact support",
    };
  }
  const currency = payment.currency;
  const productOrders = await buildProductOrders(
    savedOrder,
    basketItems,
    currency
  );
  if (!productOrders || productOrders.length === 0) {
    return {
      error:
        "Payment successful but product orders not created. Please contact support",
    };
  }

  if (!productOrders || productOrders.length === 0) {
    return {
      error:
        "Payment successful but product orders not created. Please contact support",
    };
  }
  const updateOrder = await OrderModel.findOneAndUpdate(
    { _id: savedOrder._id },
    { productOrders },
    { new: true }
  );

  const updateVariation = await updateVariationQuantity(
    basketItems,
    "subtract"
  );
  if (updateOrder && updateVariation) {
    // delete basket
    await BasketModel.findOneAndDelete({ _id: basket._id });
  }

  return {
    order: updateOrder,
    productOrders,
  };
};

const getAuthBuyerOrders = async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    const orders = await OrderModel.find({ user: authUser._id })
      .populate("productOrders")
      .populate("deliveryAddress")
      .populate("productOrders.product")
      .lean();
    return res
      .status(200)
      .send({ data: orders, message: "Orders fetched successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const getAuthVendorProductOrders = async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
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
      .populate("deliveryAddress")
      .lean();
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
    const orders = await OrderModel.find({})

      .populate("deliveryAddress")
      .populate("payment")
      .populate("user")
      .lean();
    await OrderModel.populate(orders, {
      path: "productOrders",
  
      populate: [
        { path: "product" },
        {
          path: "user",
          select: "firstName lastName",
        },
        {
          path: "shop",
          select: "shopName",
        }

      ],
    });

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
    const order = await OrderModel.findOne({ _id: order_id })
      .populate("productOrders")
      .populate("productOrders.product")
      .populate("productOrders.user")
      .populate("deliveryAddress")
      .lean();

    return res
      .status(200)
      .send({ data: order, message: "Order fetched successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const getProductOrders = async (req, res) => {
  try {
    const { status } = req.query;
    if (!status) {
      return res.status(400).send({ error: "required status" });
    }
    const limit = parseInt(req.query.limit);
    const pageNumber = parseInt(req.query.pageNumber);
    if (!limit) {
      return res.status(400).send({ error: "required limit" });
    }
    if (!pageNumber) {
      return res.status(400).send({ error: "required pageNumber" });
    }
    console.log("status", status);
    const query = {
      "status.value": status,
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
      .lean();
    if (!productOrder) {
      return res.status(400).send({ error: "Product Order not found" });
    }

    const order = await OrderModel.findOne({
      _id: productOrder.order,
    })
      .populate("deliveryAddress")
      .lean();
    const deliveryAddress = await DeliveryAddressModel.findOne({
      _id: order.deliveryAddress,
    }).lean();
    productOrder.deliveryAddress = deliveryAddress;
    return res.status(200).send({
      data: productOrder,
      message: "Product Order fetched successfully",
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
    const valideStatus = orderStatusEnums.map((s) => s.value).includes(status);
    if (!valideStatus) {
      return res.status(400).send({ error: "Invalid status" });
    }
    const productOrder = await ProductOrderModel.findOne({
      _id: productOrder_id,
    }).populate("shop");

    if (!productOrder) {
      return res.status(400).send({ error: "Product Order not found" });
    }
    const shopid = productOrder.shop.shopId;
    const authUser = await getAuthUser(req);
    if (authUser.shopId !== shopid && !authUser.superAdmin && !authUser.admin) {
      return res
        .status(400)
        .send({ error: "You are not authorized to update this product order" });
    }
    const selectedStatus = orderStatusEnums.find((s) => s.value === status);
    const UpdatedProductOrder = await ProductOrderModel.findByIdAndUpdate(
      productOrder_id,
      { status: selectedStatus },
      { new: true }
    );
    return res.status(200).send({ data: UpdatedProductOrder });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};
const cancelOrder = async (req, res) => {
  try {
    const { order_id, reason } = req.body;
    if (!order_id) {
      return res.status(400).send({ error: "required order_id" });
    }
    if (!reason) {
      return res.status(400).send({ error: "required reason" });
    }
    const order = await OrderModel.findOne({ _id: order_id });
    if (!order) {
      return res.status(400).send({ error: "Order not found" });
    }
    const productOrders = await ProductOrderModel.find({ order: order._id });
    if (!productOrders || productOrders.length === 0) {
      return res.status(400).send({ error: "Product Orders not found" });
    }
    const cancelledStatus = orderStatusEnums.find(
      (s) => s.value === "order cancelled"
    );
    const promises = productOrders.map(async (productOrder) => {
      const updatedStatus = await ProductOrderModel.findOneAndUpdate(
        { _id: productOrder._id },
        { status: cancelledStatus },
        { new: true }
      );
      return updatedStatus;
    });
    await Promise.all(promises);
    const cancel = {
      isCancelled: true,
      reason,
      cancelledAt: new Date(),
    };
    const updatedOrder = await OrderModel.findOneAndUpdate(
      { _id: order_id },
      { cancel },
      { new: true }
    );
    return res
      .status(200)
      .send({ data: updatedOrder, message: "Order Cancelled successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
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
  getProductOrder,
  cancelOrder,
};
