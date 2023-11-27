const Cart = require("../../models/cart.model");
const Product = require("../../models/product.model");
const Order = require("../../models/order.model");

const productsHelper = require("../../helpers/products");

async function updateProductQuantity(productId, newQuantity) {
  try {
    // Cập nhật số lượng trong kho của sản phẩm với ID tương ứng
    const product = await Product.findByIdAndUpdate(productId, { stock: newQuantity });

    // Kiểm tra xem sản phẩm đã được cập nhật thành công hay không
    if (!product) {
      throw new Error('Không tìm thấy sản phẩm');
    }
  } catch (error) {
    throw new Error('Đã xảy ra lỗi khi cập nhật số lượng');
  }
}

// [GET] /checkout/
module.exports.index = async (req, res) => {
  const cartId = req.cookies.cartId;

  const cart = await Cart.findOne({
    _id: cartId,
  });

  if (cart.products.length > 0) {
    for (const item of cart.products) {
      const productId = item.product_id;
      const productInfo = await Product.findOne({
        _id: productId,
      }).select("title thumbnail slug price discountPercentage");

      productInfo.priceNew = productsHelper.priceNewProduct(productInfo);

      item.productInfo = productInfo;

      item.totalPrice = productInfo.priceNew * item.quantity;
    }
  }

  cart.totalPrice = cart.products.reduce((sum, item) => sum + item.totalPrice, 0);

  res.render("client/pages/checkout/index", {
    pageTitle: "Đặt hàng",
    cartDetail: cart,
  });
};

// [POST] /checkout/order
module.exports.order = async (req, res) => {
  const cartId = req.cookies.cartId;
  const userInfo = req.body;

  const cart = await Cart.findOne({
    _id: cartId
  });

  const products = [];

  for(const product of cart.products) {
    const objectProduct = {
      product_id: product.product_id,
      price: 0,
      discountPercentage: 0,
      quantity: product.quantity,
      stock: 0
    };

    const productInfo = await Product.findOne({
      _id: product.product_id
    }).select("price discountPercentage stock");

    objectProduct.price = productInfo.price;
    objectProduct.discountPercentage = productInfo.discountPercentage;

    objectProduct.stock = productInfo.stock - objectProduct.quantity;

    products.push(objectProduct);

    try {
      
      // Xử lý cập nhật số lượng trong kho
      await updateProductQuantity(objectProduct.product_id, objectProduct.stock);

    } catch (error) {
      res.status(500).send('Đã xảy ra lỗi khi cập nhật số lượng');
    }
  }

  const orderInfo = {
    cart_id: cartId,
    userInfo: userInfo,
    products: products,
  };

  const order = new Order(orderInfo);
  order.save();

  await Cart.updateOne({
    _id: cartId
  }, {
    products: []
  });

  res.redirect(`/checkout/success/${order.id}`);
}

// [GET] /checkout/success/:orderId
module.exports.success = async (req, res) => {
  const order = await Order.findOne({
    _id: req.params.orderId
  });

  for (const product of order.products) {
    const productInfo = await Product.findOne({
      _id: product.product_id
    }).select("title thumbnail");

    product.productInfo = productInfo;

    product.priceNew = productsHelper.priceNewProduct(product);

    product.totalPrice = product.priceNew * product.quantity;
  }

  order.totalPrice = order.products.reduce((sum, item) => sum + item.totalPrice, 0);

  res.render("client/pages/checkout/success", {
    pageTitle: "Đặt hàng thành công",
    order: order
  });
}