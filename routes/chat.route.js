// chat.routes.js
const express = require("express");
const { 
  accessChat, 
  fetchChats, 
  createGroupChat, 
  updateGroupChat,
  leaveGroup,
  accessChatFromContact, 
  addContactAndCreateChat,
  getContactWithChat,
  getContactsWithChats,
  typingIndicator
} = require("../controllers/chat.controller");
const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

// 1-to-1 chat from user ID
router.post("/", protect, accessChat);

// 1-to-1 chat from contact ID
router.post("/from-contact", protect, accessChatFromContact);

// Fetch all chats
router.get("/", protect, fetchChats);

// In chat.routes.js
router.get("/contacts-with-chats", protect, getContactsWithChats);

// Create group chat
router.post("/group", protect, createGroupChat);

// Update group chat
router.put("/group/:chatId", protect, updateGroupChat);

// Leave group
router.delete("/group/:chatId/leave", protect, leaveGroup);

// Combined: Add contact and create chat
router.post("/contact-and-chat", protect, addContactAndCreateChat);

// Get contact with chat info
router.get("/contact-with-chat/:contactId", protect, getContactWithChat);

// Typing indicator
router.post("/typing", protect, typingIndicator);

module.exports = router;