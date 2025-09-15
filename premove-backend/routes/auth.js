const express = require("express");
const router = express.Router();
const { sendOtp, verifyOtp, checkJwt} = require("../controllers/authController");

router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.get("/check-jwt", checkJwt);

module.exports = router;
