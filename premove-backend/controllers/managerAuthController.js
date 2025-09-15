import db from "../config/db.js";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";

const JWT_SECRET = "YOUR_SECRET_KEY";
let managerOtpStore = {}; // in-memory OTP store

// ✅ Send OTP
export const managerSendOtp = async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.json({ success: false, error: "Missing phone" });

  try {
    const [rows] = await db
      .promise()
      .query(
        "SELECT * FROM ele_customer_manager WHERE phone_number = ? AND user_role = ?",
        [phone, "manager"]
      );

    if (!rows.length)
      return res.json({ success: false, error: "Manager not found" });

    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    console.log("Manager OTP:", otp);

    // Save OTP in memory
    managerOtpStore[phone] = { otp, expires: Date.now() + 5 * 60 * 1000 };

    // Save in DB
    await db
      .promise()
      .query(
        "UPDATE ele_customer_manager SET temp_otp = ? WHERE phone_number = ?",
        [otp, phone]
      );

    // Send via WhatsApp API
    const msg = `Your OTP is ${otp}`;
    const url = `http://whatsappapi.keepintouch.co.in/api/sendText?token=6103d1857f26a4cb49bbc8cc&phone=91${phone}&message=${encodeURIComponent(
      msg
    )}`;

    const response = await fetch(url);
    const text = await response.text();
    console.log("WhatsApp API response:", text);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Manager send OTP error:", err);
    res.json({ success: false, error: "Server error" });
  }
};

// ✅ Verify OTP
export const managerVerifyOtp = async (req, res) => {
  const { phone, otp } = req.body;
  const record = managerOtpStore[phone];
  if (!record) return res.json({ success: false, error: "OTP not found" });
  if (record.expires < Date.now())
    return res.json({ success: false, error: "OTP expired" });
  if (record.otp != otp)
    return res.json({ success: false, error: "Invalid OTP" });

  delete managerOtpStore[phone]; // OTP verified, remove from memory

  try {
    const [rows] = await db
      .promise()
      .query("SELECT * FROM ele_customer_manager WHERE phone_number = ?", [
        phone,
      ]);

    if (!rows.length)
      return res.json({ success: false, error: "Manager not found" });

    const manager = rows[0];
    const token = jwt.sign(
      { id: manager.id, phone, role: "manager" },
      JWT_SECRET,
      { expiresIn: "30d" }
    );
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;

    await db
      .promise()
      .query(
        "UPDATE ele_customer_manager SET jwt_token = ?, jwt_expiry = ? WHERE phone_number = ?",
        [token, expiry, phone]
      );

    res.json({
      success: true,
      token,
      expiry,
      user: { id: manager.id, name: manager.name, type: "manager" },
    });
  } catch (err) {
    console.error("❌ Manager verify OTP error:", err);
    res.json({ success: false, error: "Server error" });
  }
};

// ✅ Check JWT (Splash login)
export const managerCheckJwt = async (req, res) => {
  const { phone } = req.query;

  try {
    const [rows] = await db
      .promise()
      .query("SELECT * FROM ele_customer_manager WHERE phone_number = ?", [
        phone,
      ]);

    if (!rows.length) return res.json({ success: false });

    const manager = rows[0];
    if (!manager.jwt_token || Date.now() > manager.jwt_expiry)
      return res.json({ success: false });

    res.json({
      success: true,
      token: manager.jwt_token,
      expiry: manager.jwt_expiry,
      user: { id: manager.id, name: manager.name, type: "manager" },
    });
  } catch (err) {
    console.error("❌ Manager check JWT error:", err);
    res.json({ success: false });
  }
};

export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "Missing token" });

  const token = authHeader.split(" ")[1]; // "Bearer <token>"
  if (!token) return res.status(401).json({ error: "Invalid token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, phone, role }
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

export const getManagerCustomers = async (req, res) => {
  try {
    const managerId = req.user?.id;
    if (!managerId)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [managerRows] = await db
      .promise()
      .query("SELECT assign_location FROM ele_customer_manager WHERE id = ?", [
        managerId,
      ]);

    if (!managerRows.length)
      return res
        .status(404)
        .json({ success: false, error: "Manager not found" });

    const location = managerRows[0].assign_location;

    const [customers] = await db
      .promise()
      .query(
        "SELECT * FROM ele_customer_lead WHERE city_name = ? LIMIT ? OFFSET ?",
        [location, limit, offset]
      );

    const [totalRows] = await db
      .promise()
      .query(
        "SELECT COUNT(*) as total FROM ele_customer_lead WHERE city_name = ?",
        [location]
      );

    res.json({
      success: true,
      customers,
      total: totalRows[0].total,
      page,
      limit,
    });
  } catch (err) {
    console.error("❌ Error fetching manager customers:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

export const getCustomerInventory = async (req, res) => {
  try {
    const customerId = req.params.customerId;
    if (!customerId) {
      return res
        .status(400)
        .json({ success: false, error: "Missing customerId" });
    }

    const [inventory] = await db.promise().query(
      `
        SELECT inv.id,
               inv.sub_category_item_id,
               inv.quantity,
               inv.assemble_disamble,
               inv.wood_crafting,
               inv.wall_dismounting,
          
               sci.sub_category_item_name AS item_name,
               sci.sub_category_item_image AS item_image
        FROM ele_customer_inventory inv
        LEFT JOIN ele_sub_category_item sci 
               ON inv.sub_category_item_id = sci.id
        WHERE inv.lead_unique_id = (
            SELECT id 
            FROM ele_customer_lead 
            WHERE id = ? OR lead_id = ?
        )
        
        `,
      [customerId, customerId]
    );

    res.json({ success: true, inventory });
  } catch (err) {
    console.error("❌ Error fetching customer inventory:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};
// GET /manager/customers/:customerId
export const getCustomerDetails = async (req, res) => {
  try {
    const customerId = req.params.customerId;
    if (!customerId)
      return res
        .status(400)
        .json({ success: false, error: "Missing customerId" });

    // Fetch customer details
    const [rows] = await db.promise().query(
      `SELECT id, cust_name, cust_email, cust_mobile, moving_from, moving_to, city_name 
         FROM ele_customer_lead 
         WHERE id = ?`,
      [customerId]
    );

    if (!rows.length)
      return res
        .status(404)
        .json({ success: false, error: "Customer not found" });

    res.json({ success: true, customer: rows[0] });
  } catch (err) {
    console.error("❌ Error fetching customer details:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};



// GET /manager/dashboard/customers
// GET /manager/dashboard/customers
export const getDashboardCustomersBySpanco = async (req, res) => {
  try {
    // Agar spanco ko query param se lena ho, example ?spanco=s
    const spanco = 'a';
    if (!spanco)
      return res.status(400).json({ success: false, error: "Missing spanco value" });

    // Ele_customer_lead se customers fetch karo jinka spanco match kare
    const [customers] = await db
      .promise()
      .query(
        `SELECT id, cust_name, cust_email, cust_mobile, city_name, moving_from, moving_to
         FROM ele_customer_lead
         WHERE spanco = ? AND delete_status = 0
         ORDER BY lead_date DESC
         LIMIT 50`,
        [spanco]
      );

    res.json({ success: true, customers });
  } catch (err) {
    console.error("❌ Error fetching customers by spanco:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};


