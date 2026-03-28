// backend/controllers/notification.controller.js - COMPLETE FIXED VERSION
const Notification = require("../models/notification.model");

// Create new notification
exports.createNotification = async (req, res) => {
    try {
        const { userId, type, content, link } = req.body;

        if (!userId || !type || !content) {
            return res.status(400).json({ 
                success: false,
                message: "All fields are required" 
            });
        }

        const notification = await Notification.create({
            user: userId,
            type,
            content,
            link,
        });

        console.log(`✅ Notification created: ${notification._id} for user ${userId}`);

        // Emit socket event - MATCH WITH SOCKET.JS
        if (global.io) {
            global.io.to(`user:${userId}`).emit("notification_received", {  // ✅ FIXED: user:userId format
                notification,
                sentAt: new Date()
            });
            console.log(`📡 Emitted notification_received to user:${userId}`);
        } else {
            console.log("❌ global.io not available");
        }

        res.status(201).json({
            success: true,
            message: "Notification created",
            notification,
        });
    } catch (error) {
        console.error("❌ Error creating notification:", error);
        res.status(500).json({ 
            success: false,
            message: "Server error", 
            error: error.message 
        });
    }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
    try {
        const { notificationId } = req.body;

        if (!notificationId) {
            return res.status(400).json({ 
                success: false,
                message: "NotificationId is required" 
            });
        }

        const notification = await Notification.findByIdAndUpdate(
            notificationId,
            { isRead: true },
            { new: true }
        );

        // Emit socket event for notification read
        if (global.io && notification) {
            global.io.to(`user:${notification.user}`).emit("notification_marked_read", {  // ✅ FIXED
                notificationId,
                readAt: new Date()
            });
        }

        res.status(200).json({
            success: true,
            message: "Notification marked as read",
            notification,
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: "Server error", 
            error: error.message 
        });
    }
};

// Get notifications for logged-in user
exports.getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ user: req.user._id })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            notifications,
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: "Server error", 
            error: error.message 
        });
    }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { user: req.user._id, isRead: false },
            { isRead: true }
        );

        // Emit socket event
        if (global.io) {
            global.io.to(`user:${req.user._id}`).emit("all_notifications_read", {
                userId: req.user._id,
                markedAt: new Date()
            });
        }

        res.status(200).json({
            success: true,
            message: "All notifications marked as read"
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: "Server error", 
            error: error.message 
        });
    }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
    try {
        const { notificationId } = req.params;

        const notification = await Notification.findById(notificationId);
        
        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found"
            });
        }

        // Check if user owns this notification
        if (String(notification.user) !== String(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: "Not authorized to delete this notification"
            });
        }

        await Notification.findByIdAndDelete(notificationId);

        // Emit socket event
        if (global.io) {
            global.io.to(`user:${req.user._id}`).emit("notification_deleted", {
                notificationId,
                deletedAt: new Date()
            });
        }

        res.status(200).json({
            success: true,
            message: "Notification deleted"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};