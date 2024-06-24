const ClothModel = require("../../models/products/readyMadeCloth");

const getReadyMadeClothes = async (req, res) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 60;
    const sort = req.query.sort || "desc";
    const search = req.query.search || "";
    const price = req.query.price || "";
    const match = {};
    const categories = JSON.parse(req.query.categories);
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

    const readyMadeClothes = await ClothModel.find(query)
      .sort({ createdAt: sort })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.status(200).json({ readyMadeClothes });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
