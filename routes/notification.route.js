const express = require("express");
const {
    createNotification,
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
} = require("../controllers/notification.controller");

const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

// Create a notification
router.post("/", createNotification);

// Get all notifications for logged-in user
router.get("/", protect, getNotifications);

// Mark notification as read
router.put("/read", protect, markAsRead);

// Mark all notifications as read
router.put("/read-all", protect, markAllAsRead);

// Delete a notification
router.delete("/:notificationId", protect, deleteNotification);

module.exports = router;