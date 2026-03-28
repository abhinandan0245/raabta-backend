const express = require("express");
const { 
  sendMessage, 
  getMessages, 
  getUnreadCount,
  getAllUnreadCounts,
  markChatAsRead,
  markMessagesAsRead,
  deleteMessage,
  editMessage,
  updateOnlineStatus
} = require("../controllers/message.controller");
const { protect } = require("../middleware/auth.middleware");
const { messageUpload } = require("../middleware/messageUpload");

const router = express.Router();

// Send message
// Send message - with file upload support
router.post("/", protect, messageUpload.array('attachments', 10), sendMessage);

// Get messages for a chat
router.get("/:chatId", protect, getMessages);

// Get unread count for a specific chat
router.get("/unread/:chatId", protect, getUnreadCount);

// Get all unread counts for user
router.get("/unread/all", protect, getAllUnreadCounts);

// Mark all messages in a chat as read
router.post("/mark-read/chat/:chatId", protect, markChatAsRead);

// Mark specific messages as read
router.post("/mark-read/messages", protect, markMessagesAsRead);

// Delete message
router.delete("/:messageId", protect, deleteMessage);

// Edit message
router.put("/:messageId", protect, editMessage);

// Update online status
router.put("/status/online", protect, updateOnlineStatus);

module.exports = router;