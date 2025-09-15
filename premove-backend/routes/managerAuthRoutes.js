import express from "express";
import {
  managerSendOtp,
  managerVerifyOtp,
  managerCheckJwt,
  authMiddleware,
  getManagerCustomers,
  getCustomerInventory,
  getCustomerDetails,
  getDashboardCustomersBySpanco,
} from "../controllers/managerAuthController.js";

const router = express.Router();

// Manager OTP routes
router.post("/manager/send-otp", managerSendOtp);
router.post("/manager/verify-otp", managerVerifyOtp);
router.get("/manager/check-jwt", managerCheckJwt);
router.get("/manager/dashboard/customers", getDashboardCustomersBySpanco);
router.get("/manager/customers", authMiddleware, getManagerCustomers);
router.get(
  "/manager/customers/:customerId/inventory",
  authMiddleware,
  getCustomerInventory
);

router.get('/manager/customers/:customerId', authMiddleware, getCustomerDetails);
export default router;
