const { sellerPolicyLink } = require("../helpers/constants");

const getSellerPolicyLink = (req, res) => {
  try {
    const data = { link: sellerPolicyLink || "", name: "Seller Policy" };
    return res.status(200).send({data, message: "Seller policy link fetched successfully"});
  } catch (error) {
    return res.status(500).send({ error: "Internal Server Error" });
  }
};

module.exports = {
  getSellerPolicyLink,
};
