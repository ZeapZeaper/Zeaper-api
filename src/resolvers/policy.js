const { sellerPolicyLink, vendorContract } = require("../helpers/constants");
const { getAuthUser } = require("../middleware/firebaseUserAuth");

const getSellerPolicyLink = async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return res.status(401).send({ error: "Unauthorized" });
    }
   

    const data = [
      {
        link: vendorContract || "",
        name: authUser?.shopId
          ? " Your Signed Contract with Zeaper"
          : "Zeaper Vendor Contract",
      },
      {
        link: sellerPolicyLink || "",
        name: "Zeaper Policy, Guidelines And Terms",
      },
    ];
    return res
      .status(200)
      .send({ data, message: "Seller policy link fetched successfully" });
  } catch (error) {
    return res.status(500).send({ error: "Internal Server Error" });
  }
};

module.exports = {
  getSellerPolicyLink,
};
