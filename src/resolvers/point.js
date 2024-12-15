const { getAuthUser } = require("../middleware/firebaseUserAuth");
const PointModel = require("../models/points");

const getAuthUserPoint = async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res.status(400).send({ error: "User not found" });
    }
    const point = await PointModel.findOne({
      user: authUser._id,
    });

    return res.status(200).send({
      data: point,
      message: "Point fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

const getUserPoint = async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).send({ error: "required user_id" });
    }
    const point = await PointModel.findOne({
      user: user_id,
    });
    return res.status(200).send({
      data: point,
      message: "Point fetched successfully",
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
};

module.exports = {
  getAuthUserPoint,
  getUserPoint,
};
