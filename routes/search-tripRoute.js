const express = require("express");
const models = require("../models");
const Router = express.Router();

const controller = require("../controllers/search-tripController");
const tripInfoController = require("../controllers/trip-infoController");
const controller1 = require("../controllers/xacnhanController");
const controller2 = require("../controllers/thongtinkhachhangController");
const controller3 = require("../controllers/thanhtoanController");
const userController = require('../controllers/userController');
const { Model } = require("sequelize");
const Mailjet = require('node-mailjet');
const mailjet = Mailjet.apiConnect(
  process.env.MJ_APIKEY_PUBLIC || '8c1ec4ae629a793fc6de402c4cec9748',
  process.env.MJ_APIKEY_PRIVATE || '891875623af5ec6e57624095a379e8d5',
);
Router.get("/:id", tripInfoController.show);
Router.get("/", controller.show);
Router.get("/:id/thanh-toan/xacnhan", userController.isLoggedIn, controller1.show);
Router.get("/:id/thanh-toan/thongtinkhachhang", userController.isLoggedIn, controller2.show);
Router.get("/:id/thanh-toan/thanhtoan", userController.isLoggedIn, controller3.show);
Router.post("/:id/thanh-toan/thanhtoan", controller3.Payment);
Router.get("/:id/thanh-toan/thanhcong", controller3.Success);
Router.get("/:id/thanh-toan/thatbai", controller3.Cancel);
Router.post("/:id/thanh-toan/thanhcong", controller3.PaymentCOD);

module.exports = Router;
