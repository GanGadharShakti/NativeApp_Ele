import db from "../config/db.js";
import axios from "axios";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";

const WHATSAPP_API_URL = "http://whatsappapi.keepintouch.co.in/api/sendText";
const WHATSAPP_TOKEN = "YOUR_PINSTORE_TOKEN"; // replace with your token
const JWT_SECRET = "YOUR_SECRET_KEY";

// in-memory OTP store
let otpStore = {};

// ✅ Generate random OTP
function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// ✅ Send OTP
export const sendOtp = async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Phone number required" });

  db.query(
    "SELECT id FROM ele_customer_lead WHERE cust_mobile=? LIMIT 1",
    [phone],
    async (err, results) => {
      if (err) return res.status(500).json({ error: "DB error" });
      if (!results.length)
        return res.status(400).json({ error: "Phone not registered" });

      const otp = generateOTP();
      otpStore[phone] = { otp, expires: Date.now() + 5 * 60 * 1000 };
      console.log(`OTP for ${phone}: ${otp}`);

      try {
        const msg = `Your OTP for login is: ${otp}`;
        await fetch(
          `${WHATSAPP_API_URL}?token=${WHATSAPP_TOKEN}&phone=91${phone}&message=${encodeURIComponent(
            msg
          )}`
        );
        res.json({ success: true, message: "OTP sent via WhatsApp" });
      } catch (error) {
        console.error("❌ WhatsApp send error:", error);
        res.status(500).json({ error: "Failed to send OTP" });
      }
    }
  );
};

// ✅ Verify OTP
export const verifyOtp = (req, res) => {
  const { phone, otp } = req.body;
  const record = otpStore[phone];

  if (!record) return res.status(400).json({ error: "OTP not found" });
  if (record.expires < Date.now())
    return res.status(400).json({ error: "OTP expired" });
  if (record.otp != otp) return res.status(400).json({ error: "Invalid OTP" });

  // remove OTP once used
  delete otpStore[phone];

  db.query(
    "SELECT * FROM ele_customer_lead WHERE cust_mobile=? LIMIT 1",
    [phone],
    (err, results) => {
      if (err) return res.status(500).json({ error: "DB error" });
      const user = results[0];

      // create JWT
      const token = jwt.sign({ id: user.id, phone }, JWT_SECRET, {
        expiresIn: "30d",
      });
      const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;

      // save JWT in DB
      db.query(
        "UPDATE ele_customer_lead SET jwt_token=?, jwt_expiry=? WHERE id=?",
        [token, expiry, user.id],
        (err2) => {
          if (err2) console.error("❌ JWT save error:", err2);
          res.json({
            success: true,
            token,
            expiry,
            user,
          });
        }
      );
    }
  );
};

// ✅ Check JWT (auto login)
export const checkJwt = (req, res) => {
  const { phone } = req.query;

  db.query(
    "SELECT * FROM ele_customer_lead WHERE cust_mobile=? LIMIT 1",
    [phone],
    (err, results) => {
      if (err || !results.length) return res.json({ success: false });

      const user = results[0];
      if (user.jwt_token && user.jwt_expiry && Date.now() < user.jwt_expiry) {
        return res.json({
          success: true,
          token: user.jwt_token,
          expiry: user.jwt_expiry,
          user,
        });
      }
      res.json({ success: false });
    }
  );
};
