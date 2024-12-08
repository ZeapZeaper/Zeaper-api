const BasketModel = require("../models/basket");
const DeliveryAddressModel = require("../models/deliveryAddresses");
const OrderModel = require("../models/order");
const ProductModel = require("../models/products");
const ShopModel = require("../models/shop");

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

const buildShopOrders = async (basketItems) => {
  return new Promise(async (resolve) => {
    const shopOrders = [];
    const shop_ids = basketItems.map((item) => item.product.shop);
    const shops = await ShopModel.find({
      _id: { $in: shop_ids },
    }).lean();

    basketItems.forEach(async (item) => {
      const shop = shops.find(
        (shop) => shop._id.toString() === item.product.shop.toString()
      );

      const shopOrder = shopOrders.find((order) => order.shop === shop?._id);

      if (shopOrder) {
        shopOrder.basketItems.push(item);
      } else if (shop) {
        shopOrders.push({
          shop: shop?._id,
          basketItems: [item],
          status: "pending",
        });
      }
    });

    resolve(shopOrders);
  });
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
  })
    .populate("basketItems.product")
    .lean();
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
  const shopOrders = await buildShopOrders(basketItems);

  const orderId = await generateUniqueOrderId();

  const order = new OrderModel({
    orderId,
    user: user,
    basket: basket?._id,
    deliveryAddress: basket?.deliveryAddress,
    payment: payment?._id,
    status: "pending",
    basketItems: basket?.basketItems,
    shopOrders,
  });

  const savedOrder = await order.save();
  if (!savedOrder?._id) {
    return {
      error: "Payment successful but order not created. Please contact support",
    };
  }
  const updateVariation = await updateVariationQuantity(basketItems, "subtract");
  return savedOrder;
};

module.exports = {
  createOrder,
};
