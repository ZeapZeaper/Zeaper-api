const ReadyMadeClothes = require("../../models/products/readyMadeCloth");

const getReadyMadeClothes = async (req, res) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 60;
    const sort = req.query.sort || "desc";
    const search = req.query.search || "";
    const price = req.query.price || "";
    const disabled = req.query.disabled || false;
    const status = req.query.status || "live";
    const match = {
      disabled,
      status,
    };
    const categories = send.parse(req.query.categories);
    Object.entries(categories).forEach(([key, value]) => {
      if (value) {
        match[`categories.${key}`] = value;
      }
    });
    // search
    if (search) {
      match.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }
    const query = { ...match };

    if (price) {
      query.price = { $lte: parseInt(price) };
    }

    const readyMadeClothes = await ReadyMadeClothes.find(query)
      .sort({ createdAt: sort })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.status(200).send({ readyMadeClothes });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const editReadyMadeClothes = async (params) => {
  try {
    const { productId } = params;
    const readyMadeClothes = await ReadyMadeClothes.findOneAndUpdate(
      productId,
      {
        ...params,
      },
      { new: true }
    );
    return readyMadeClothes;
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const deleteRestoreReadyMadeClothes = async (
  productIds,
  userId,
  disabledValue
) => {
  return productIds.reduce(async (acc, _id) => {
    const result = await acc;

    const disabled = await ReadyMadeClothes.findByIdAndUpdate(
      _id,
      { disabled: disabledValue },
      { new: true }
    );

    if (disabled) {
      result.push(_id);
    }

    return result;
  }, []);
};
const deleteReadyMadeClothes = async (param) => {
  try {
    const { productIds, userId } = param;
    const deletedProducts = await deleteRestoreReadyMadeClothes(
      productIds,
      userId,
      true
    );
    return deletedProducts;
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const restoreReadyMadeClothes = async (param) => {
  try {
    const { productIds, userId } = param;
    const restoredProducts = await deleteRestoreReadyMadeClothes(
      productIds,
      userId,
      false
    );
    return restoredProducts;
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};
const createReadyMadeClothes = async (param) => {
  try {

    const readyMadeClothes = new ReadyMadeClothes(param);

    const savedReadyMadeClothes = await readyMadeClothes.save();

    return savedReadyMadeClothes;
  } catch (err) {
    throw new Error(err.message);
  }
};
module.exports = {
  getReadyMadeClothes,
  deleteReadyMadeClothes,
  restoreReadyMadeClothes,
  createReadyMadeClothes,
  editReadyMadeClothes,
};
