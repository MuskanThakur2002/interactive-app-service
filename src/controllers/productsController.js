const Products = require("../models/Products");

const getProducts = async (req, res) => {
  try {
    const products = await Products.find(); // Fetch all products
    res.status(200).json(products); // Send products as JSON response
  } catch (error) {
    res
      .status(500)
      .json({ error: "An error occurred while fetching products" });
  }
};

module.exports = { getProducts };
