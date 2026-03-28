// routes/contact.routes.js

const express = require("express");
const {
  addContact,
  updateContact,
  deleteContact,
  blockContact,
  unblockContact,
  getContact,
  getAllContacts,
} = require("../controllers/contact.controller");
const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

// Add new contact
router.post("/", protect, addContact);

// Update contact by ID
router.put("/:id", protect, updateContact);

// Delete contact by ID
router.delete("/:id", protect, deleteContact);

// Block contact for current user
router.post("/:id/block", protect, blockContact);

// Unblock contact for current user
router.post("/:id/unblock", protect, unblockContact);

// Get single contact by ID
router.get("/:id", protect, getContact);

// Get all contacts created by current user
router.get("/", protect, getAllContacts);

module.exports = router;
