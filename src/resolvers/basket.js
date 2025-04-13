const { currencyEnums } = require("../helpers/constants");
const {
  calculateTotalBasketPrice,
  validateBodyMeasurements,
  currencyCoversion,

  calcRate,
} = require("../helpers/utils");
const { getAuthUser } = require("../middleware/firebaseUserAuth");
const BasketModel = require("../models/basket");
const BodyMeasurementModel = require("../models/bodyMeasurement");
const BodyMeasurementGuideModel = require("../models/bodyMeasurementGuide");

const BodyMeasurementTemplateModel = require("../models/bodyMeasurementTemplate");
const ProductOrderModel = require("../models/productOrder");
const ProductModel = require("../models/products");

function getRandomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const generateUniqueBasketId = async () => {
  let basketId;
  let found = true;

  do {
    const randomVal = getRandomInt(1000000, 9999999);
    basketId = `${randomVal}`;
    const exist = await BasketModel.findOne(
      {
        basketId,
      },
      { lean: true }
    );

    if (exist) {
      found = true;
    } else {
      found = false;
    }
  } while (found);

  return basketId.toString();
};

const validateProductBodyMeasurements = async (product, bodyMeasurements) => {
  const { variations } = product;
  const bespokeVariation = variations.find((v) => v.bespoke?.isBespoke);
  let error;

  if (bespokeVariation) {
    if (!bodyMeasurements) {
      return {
        error:
          "required body measurements since product is bespoke and requires body measurements",
      };
    }
    const bodyMeasurementEnums = await BodyMeasurementGuideModel.find().lean();

    const mappedBodyMeasurementEnums = bodyMeasurementEnums.map((b) => {
      const { name, fields } = b;
      return {
        name,
        fields: fields.map((f) => f.field),
      };
    });
    const mergedBodyMeasurementEnums = mappedBodyMeasurementEnums.reduce(
      (acc, cur) => {
        const found = acc.find((m) => m.name === cur.name);
        if (found) {
          found.fields = [...found.fields, ...cur.fields];
        } else {
          acc.push(cur);
        }
        return acc;
      },
      []
    );

    const validateMeasurements = validateBodyMeasurements(
      bodyMeasurements,
      mergedBodyMeasurementEnums
    );

    if (validateMeasurements.error) {
      return {
        error: validateMeasurements.error,
      };
    }
    const productBodyMeasurement = product.bodyMeasurement;

    const expectedProductBodyMeasurement = await BodyMeasurementModel.findOne({
      _id: productBodyMeasurement,
    }).lean();
    if (!expectedProductBodyMeasurement) {
      return {
        error: "Product body measurement not found, please contact support",
      };
    }
    // check if measurements match the expected body measurement
    const expectedMeasurements = expectedProductBodyMeasurement.measurements;
    const expectedMeasurementNames = expectedMeasurements.map((m) => m.name);
    const measurementNames = bodyMeasurements.map((m) => m.name);
    const missingMeasurements = expectedMeasurementNames.filter(
      (m) => !measurementNames.includes(m)
    );
    if (missingMeasurements.length > 0) {
      return {
        error: `missing measurements: ${missingMeasurements.join(", ")}`,
      };
    }
    expectedMeasurements.map((m) => {
      const { name, fields } = m;
      const bodyMeasurement = bodyMeasurements.find((bm) => bm.name === name);

      if (!bodyMeasurement) {
        error = `missing measurement: ${name}`;
      }
      const measurements = bodyMeasurement.measurements;
      // check if every field in fields is in measurements array object.field
      fields.map((f) => {
        const fieldMeasurement = measurements.find(
          (m) =>
            m.field.toLowerCase().replace(/\s/g, "") ===
            f.toLowerCase().replace(/\s/g, "")
        );

        if (!fieldMeasurement || fieldMeasurement === undefined) {
          return (error = `missing field: ${f} for measurement: ${m.name}`);
        }
        if (!fieldMeasurement.value) {
          error = `missing value for field: ${f} for measurement: ${m.name}`;
        }
      });

      // if (measurement.fields.length !== m.fields.length) {
      //   return {
      //     error: `invalid fields for measurement: ${m.name}`,
      //   };
      // }
      // const invalidFields = measurement.fields.filter(
      //   (f) => !m.fields.includes(f)
      // );
      // if (invalidFields.length > 0) {
      //   return {
      //     error: `invalid fields for measurement: ${m.name}`,
      //   };
      // }
    });

    if (error) {
      return { error };
    }
    return { success: true };
  }
  return { success: true };
};
const validateProductAvailability = async (
  product,
  quantity,
  sku,
  bespokeColor
) => {
  const { variations } = product;
  const bespokeVariation = variations.find(
    (v) => v.sku === sku && v?.bespoke?.isBespoke
  );
  if (bespokeVariation) {
    const bespoke = bespokeVariation.bespoke;
    if (bespoke?.colorType === "single" && !bespokeColor) {
      return {
        error:
          "required selected bespokeColor from available since product is bespoke and has colorType single",
      };
    }
    if (bespoke?.colorType === "multiple" && bespokeColor) {
      return {
        error:
          "selected bespokeColor is not required since product is bespoke and has colorType multiple. The buyer gets the exact displayed color",
      };
    }
    const availableColors = bespoke.availableColors;
    if (bespokeColor && !availableColors.includes(bespokeColor)) {
      return {
        error: `selected bespokeColor is not available for product with sku ${sku}. available colors are ${availableColors.join(
          ", "
        )}`,
      };
    }
    return { success: true };
  }

  const variation = variations.find((v) => v.sku === sku);
  if (!variation) {
    return { error: "Product variation not found. ensure sku is correct" };
  }
  if (variation.quantity === 0) {
    return { error: `Product with sku ${sku} is out of stock` };
  }
  if (variation.quantity < quantity) {
    return {
      error: `Product with sku ${sku} has only ${variation.quantity} left`,
    };
  }
  return { success: true };
};
const getBaskets = async (req, res) => {
  try {
    const baskets = await BasketModel.find(req.query)
      .populate("user")
      .populate("basketItems.product")
      .lean();
    for (let i = 0; i < baskets.length; i++) {
      const basketCalc = await calculateTotalBasketPrice(baskets[i]);

      baskets[i].appliedVoucherAmount = basketCalc.appliedVoucherAmount;
      baskets[i].deliveryFee = basketCalc.deliveryFee;
      baskets[i].itemsTotal = basketCalc.itemsTotal;

      baskets[i].total = basketCalc.total;
      const items = basketCalc.items;

      for (let j = 0; j < baskets[i].basketItems.length; j++) {
        const item = items.find(
          (item) => item.item.sku === baskets[i].basketItems[j].sku
        );

        baskets[i].basketItems[j].price = item.totalPrice;
      }
      if (basketCalc?.totalWithoutVoucher) {
        baskets[i].totalWithoutVoucher = basketCalc.totalWithoutVoucher;
      }
    }

    return res
      .status(200)
      .send({ message: "Baskets fetched successfully", data: baskets });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const getBasket = async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(400).send({ error: "User not found, please login" });
    }
    const currency = user.prefferedCurrency || "NGN";

    const basket = await BasketModel.findOne({ user: user._id })
      .populate("voucher")
      .populate("basketItems.product", "productId title variations colors")
      .lean();
    if (!basket) {
      return res
        .status(200)
        .send({ data: {}, message: "No basket found / empty basket" });
    }
    let rate = null;
    if (currency !== "NGN") {
      const currencyRates = await ExchangeRateModel.find();
      rate = currencyRates.find((rate) => rate.currency === currency).rate;
    }

    const basketCalc = await calculateTotalBasketPrice(basket);

    const subTotal = calcRate(rate, currency, basketCalc.itemsTotal);
    const deliveryFee = calcRate(rate, currency, basketCalc.deliveryFee);
    const total = calcRate(rate, currency, basketCalc.total);
    const appliedVoucherAmount = calcRate(
      rate,
      currency,
      basketCalc.appliedVoucherAmount
    );
    const totalWithoutVoucher = calcRate(
      rate,
      currency,
      basketCalc.totalWithoutVoucher || total + appliedVoucherAmount
    );
    basket.currency = currency;
    basket.appliedVoucherAmount = appliedVoucherAmount;
    basket.deliveryFee = deliveryFee;
    basket.subTotal = subTotal;
    basket.total = total;
    basket.totalWithoutVoucher = totalWithoutVoucher;
    const items = basketCalc.items;
    for (let i = 0; i < basket.basketItems.length; i++) {
      const item = items.find(
        (item) => item.item.sku === basket.basketItems[i].sku
      );
      basket.basketItems[i].currency = currency;
      basket.basketItems[i].actualAmount = calcRate(
        rate,
        currency,
        item.actualAmount
      );
      basket.basketItems[i].discountedAmount = calcRate(
        rate,
        currency,
        item.discount
      );
      basket.basketItems[i].originalAmount = calcRate(
        rate,
        currency,
        item.originalAmount
      );

      const title = basket.basketItems[i].product.title;
      const productId = basket.basketItems[i].product.productId;
      const sku = basket.basketItems[i].sku;
      const colors = basket.basketItems[i].product.colors;
      const variations = basket.basketItems[i].product.variations;
      const variation = variations.find((v) => v.sku === sku);
      const chosenColor = colors.find((c) => c.value === variation.colorValue);
      const image = chosenColor?.images.find((image) => image.link !== "");
      const color = chosenColor?.value;
      const size = variation.size;
      basket.basketItems[i].color = color;
      basket.basketItems[i].size = size;
      basket.basketItems[i].image = image?.link || {};
      basket.basketItems[i].title = title;
      basket.basketItems[i].productId = productId;
      delete basket.basketItems[i].product;
    }

    return res.status(200).send({
      message: basket ? "Basket fetched successfully" : "No basket found",
      data: basket,
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const deleteBasket = async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(400).send({ error: "User not found, please login" });
    }
    const basket = await BasketModel.findOneAndDelete({
      user: user._id,
    }).lean();
    if (!basket) {
      return res.status(400).send({ error: "Basket not found" });
    }
    return res.status(200).send({ message: "Basket deleted successfully" });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const compareBodyMeasurements = (bodyMeasurements1, bodyMeasurements2) => {
  // compare body measurements array of objects with name and fields
  // return true if they are the same
  // return false if they are not the same
  if (bodyMeasurements1.length === 0 && bodyMeasurements2.length === 0) {
    return true;
  }
  if (bodyMeasurements1.length !== bodyMeasurements2.length) {
    return false;
  }
  const names1 = bodyMeasurements1.map((m) => m.name);

  const names2 = bodyMeasurements2.map((m) => m.name);

  if (names1.length !== names2.length) {
    return false;
  }

  const missingNames = names1.filter((n) => !names2.includes(n));
  if (missingNames.length > 0) {
    return false;
  }
  for (let i = 0; i < bodyMeasurements1.length; i++) {
    const measurement1 = bodyMeasurements1[i];
    const measurement2 = bodyMeasurements2.find(
      (m) => m.name === measurement1.name
    );
    if (!measurement2) {
      return false;
    }
    const fields1 = measurement1.measurements;
    const fields2 = measurement2.measurements;
    if (fields1.length !== fields2.length) {
      return false;
    }
    const fieldNames1 = fields1.map((f) => f.field);
    const fieldNames2 = fields2.map((f) => f.field);
    if (fieldNames1.length !== fieldNames2.length) {
      return false;
    }
    const missingFields = fieldNames1.filter((f) => !fieldNames2.includes(f));
    if (missingFields.length > 0) {
      return false;
    }
    for (let j = 0; j < fields1.length; j++) {
      const field1 = fields1[j];
      const field2 = fields2.find((f) => f.field === field1.field);
      if (!field2) {
        return false;
      }
      if (field1.value !== field2.value) {
        return false;
      }
    }
  }

  return true;
};

const addProductToBasket = async (req, res) => {
  try {
    const {
      productId,
      quantity,
      sku,
      bespokeColor,
      bodyMeasurements,
      bespokeInstruction,
    } = req.body;

    if (!productId) {
      return res.status(400).send({ error: "required productId" });
    }
    if (!quantity) {
      return res.status(400).send({ error: "required quantity" });
    }
    if (!sku) {
      return res.status(400).send({ error: "required sku" });
    }
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(400).send({ error: "User not found, please login" });
    }
    const product = await ProductModel.findOne({ productId }).lean();
    if (!product) {
      return res.status(400).send({ error: "Product not found" });
    }
    if (product?.status !== "live") {
      return res.status(400).send({ error: "Product is not live" });
    }
    const validSku = product.variations.find((v) => v.sku === sku);
    if (!validSku) {
      return res.status(400).send({ error: "Invalid sku" });
    }

    const validation = await validateProductAvailability(
      product,
      quantity,
      sku,
      bespokeColor
    );
    if (validation.error) {
      return res.status(400).send({ error: validation.error });
    }

    const bodyMeasurementValidation = await validateProductBodyMeasurements(
      product,
      bodyMeasurements
    );
    if (bodyMeasurementValidation.error) {
      return res.status(400).send({ error: bodyMeasurementValidation.error });
    }

    const basket = await BasketModel.findOne({ user: user._id }).lean();
    if (!basket) {
      const basketId = await generateUniqueBasketId();
      const newBasket = await BasketModel.create({
        user: user._id,
        basketId,
        basketItems: [
          {
            product: product._id,
            quantity,
            sku,
            bodyMeasurements,
            bespokeColor,
            bespokeInstruction,
          },
        ],
      });
      return res.status(200).send({
        message: "Product added to basket successfully",
        data: newBasket,
      });
    }

    const basketItems = basket.basketItems;
    const itemIndex = basketItems.findIndex((item) => {
      if (bodyMeasurements && item.bodyMeasurements) {
        return (
          item.product.toString() === product._id.toString() &&
          item.sku === sku &&
          compareBodyMeasurements(
            item.bodyMeasurements || [],
            bodyMeasurements || []
          )
        );
      }

      return (
        item.product.toString() === product._id.toString() && item.sku === sku
      );
    });

    if (itemIndex !== -1) {
      basketItems[itemIndex].quantity += quantity;
      basketItems[itemIndex].bespokeColor = bespokeColor;
      basketItems[itemIndex].bodyMeasurements = bodyMeasurements;
      basketItems[itemIndex].bespokeInstruction = bespokeInstruction;
    } else {
      basketItems.push({
        product: product._id,
        quantity,
        sku,
        bespokeColor,
        bodyMeasurements,
        bespokeInstruction,
      });
    }
    const updatedBasket = await BasketModel.findByIdAndUpdate(
      basket._id,
      { basketItems },
      { new: true }
    ).lean();
    if (!updatedBasket) {
      return res.status(400).send({ error: "Product not added to basket" });
    }
    return res.status(200).send({
      message: "Product added to basket successfully",
      data: updatedBasket,
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const removeProductFromBasket = async (req, res) => {
  try {
    const { sku } = req.body;

    if (!sku) {
      return res.status(400).send({ error: "required sku" });
    }
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(400).send({ error: "User not found, please login" });
    }
    const basket = await BasketModel.findOne({ user: user._id }).lean();
    if (!basket) {
      return res.status(400).send({ error: "Basket not found" });
    }
    const basketItems = basket.basketItems;
    const itemIndex = basketItems.findIndex((item) => item.sku === sku);
    if (itemIndex === -1) {
      return res.status(400).send({ error: "Product not found in basket" });
    }
    basketItems.splice(itemIndex, 1);
    const updatedBasket = await BasketModel.findByIdAndUpdate(
      basket._id,
      { basketItems },
      { new: true }
    ).lean();
    if (!updatedBasket) {
      return res.status(400).send({ error: "Product not removed from basket" });
    }
    return res.status(200).send({
      message: "Product removed from basket successfully",
      data: updatedBasket,
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const increaseProductQuantity = async (req, res) => {
  try {
    const { sku } = req.body;

    if (!sku) {
      return res.status(400).send({ error: "required sku" });
    }
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(400).send({ error: "User not found, please login" });
    }
    const basket = await BasketModel.findOne({ user: user._id }).lean();
    if (!basket) {
      return res.status(400).send({ error: "Basket not found" });
    }
    const basketItems = basket.basketItems;
    const itemIndex = basketItems.findIndex((item) => item.sku === sku);
    if (itemIndex === -1) {
      return res.status(400).send({ error: "Product not found in basket" });
    }
    basketItems[itemIndex].quantity += 1;
    const updatedBasket = await BasketModel.findByIdAndUpdate(
      basket._id,
      { basketItems },
      { new: true }
    ).lean();
    if (!updatedBasket) {
      return res.status(400).send({ error: "Product quantity not increased" });
    }
    return res.status(200).send({
      message: "Product quantity increased successfully",
      data: updatedBasket,
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const decreaseProductQuantity = async (req, res) => {
  try {
    const { sku } = req.body;

    if (!sku) {
      return res.status(400).send({ error: "required sku" });
    }
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(400).send({ error: "User not found, please login" });
    }
    const basket = await BasketModel.findOne({ user: user._id }).lean();
    if (!basket) {
      return res.status(400).send({ error: "Basket not found" });
    }
    const basketItems = basket.basketItems;
    const itemIndex = basketItems.findIndex((item) => item.sku === sku);
    if (itemIndex === -1) {
      return res.status(400).send({ error: "Product not found in basket" });
    }
    if (basketItems[itemIndex].quantity === 1) {
      basketItems.splice(itemIndex, 1);
    } else {
      basketItems[itemIndex].quantity -= 1;
    }
    const updatedBasket = await BasketModel.findByIdAndUpdate(
      basket._id,
      { basketItems },
      { new: true }
    ).lean();
    if (!updatedBasket) {
      return res.status(400).send({ error: "Product quantity not decreased" });
    }
    return res.status(200).send({
      message: "Product quantity decreased successfully",
      data: updatedBasket,
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const getBasketTotal = async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(400).send({ error: "User not found, please login" });
    }
    const currency = user.prefferedCurrency || "NGN";
    const basket = await BasketModel.findOne({ user: user._id }).lean();
    if (!basket) {
      return res.status(400).send({ error: "Basket not found" });
    }
    // use Promise to wait for the total to be calculated
    const basketTotal = await calculateTotalBasketPrice(basket);
    const totalAmount = basketTotal.total;
    const itemTotalAmount = basketTotal.itemsTotal;
    const deliveryFee = basketTotal.deliveryFee;

    const convertedAmount = await currencyCoversion(totalAmount, currency);
    const convertedItemTotalAmount = await currencyCoversion(
      itemTotalAmount,
      currency
    );
    const convertedDeliveryFee = await currencyCoversion(deliveryFee, currency);
    const total = {
      total: convertedAmount,
      itemsTotal: convertedItemTotalAmount,
      deliveryFee: convertedDeliveryFee,
      currency,
    };

    return res.status(200).send({
      message: "Basket total fetched successfully",
      data: total,
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

module.exports = {
  getBasket,
  getBaskets,
  getBasketTotal,
  deleteBasket,
  addProductToBasket,
  removeProductFromBasket,
  increaseProductQuantity,
  decreaseProductQuantity,
  generateUniqueBasketId
};
