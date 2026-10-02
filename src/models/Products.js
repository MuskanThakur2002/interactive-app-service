const { mongoose } = require("../utils/DatabaseUtils");

const productSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      nullable: false
    },
    diamonds: {
      type: Number,
      required: true,
      nullable: false
    },
    currency: {
      type: String,
      required: true,
      default: "USD"
    },
    amount: {
      type: String,
      required: true,
      nullable: false
    },
    image: {
      type: String,
      required: true,
      nullable: false
    }
  },
  { timestamps: true }
);

const Products = mongoose.model("Products", productSchema);

module.exports = Products;

