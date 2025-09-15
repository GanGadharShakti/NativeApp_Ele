import express from "express";
import {
  getCategories,
  getAllItems,
  // getSubCategoryItems,
  getInventoryByLead,
  getSubCategoryItem,
} from "../controllers/categoryController.js";

const router = express.Router();

router.get("/categories", getCategories);
router.get("/all-items", getAllItems);
// router.get("/sub-category-items/:sub_category_id", getSubCategoryItems);
router.get("/inventory/:lead_unique_id", getInventoryByLead);
router.get("/sub-category-item/:id", getSubCategoryItem);

export default router;
