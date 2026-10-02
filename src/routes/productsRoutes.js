const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware"); // Assuming you have auth middleware

const {
  getProducts,
} = require("../controllers/ProductsController");

router.get("/", getProducts);

module.exports = router;
