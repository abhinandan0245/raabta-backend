// backend/sockets/notification.js
const Notification = require("../models/notification.model");

module.exports = (io, socket) => {
    // Create and save notification
    socket.on("create_notification", async (notificationData) => {
        try {
            const { userId, type, content, link } = notificationData;
            
            // Save to database
            const notification = await Notification.create({
                user: userId,
                type,
                content,
                link,
                isRead: false
            });

            console.log(`✅ Notification saved for user ${userId}:`, notification._id);
            
            // Emit to user's room with proper naming
            io.to(`user:${userId}`).emit("notification_received", {
                notification,
                sentAt: new Date()
            });
            
        } catch (error) {
            console.error("❌ Error creating notification:", error);
        }
    });

    // Mark notification as read and update database
    socket.on("notification_read", async ({ notificationId, userId }) => {
        try {
            // Update in database
            const notification = await Notification.findByIdAndUpdate(
                notificationId,
                { isRead: true },
                { new: true }
            );

            if (notification) {
                console.log(`✅ Notification ${notificationId} marked as read`);
                
                // Emit to user
                io.to(`user:${userId}`).emit("notification_marked_read", {
                    notificationId,
                    readAt: new Date()
                });
            }
        } catch (error) {
            console.error("❌ Error marking notification as read:", error);
        }
    });

    // Mark all notifications as read
    socket.on("mark_all_notifications_read", async ({ userId }) => {
        try {
            await Notification.updateMany(
                { user: userId, isRead: false },
                { isRead: true }
            );

            console.log(`✅ All notifications marked as read for user ${userId}`);
            
            io.to(`user:${userId}`).emit("all_notifications_read", {
                userId,
                readAt: new Date()
            });
        } catch (error) {
            console.error("❌ Error marking all notifications as read:", error);
        }
    });

    // Delete notification
    socket.on("delete_notification", async ({ notificationId, userId }) => {
        try {
            await Notification.findByIdAndDelete(notificationId);
            
            console.log(`✅ Notification ${notificationId} deleted`);
            
            io.to(`user:${userId}`).emit("notification_deleted", {
                notificationId,
                deletedAt: new Date()
            });
        } catch (error) {
            console.error("❌ Error deleting notification:", error);
        }
    });
};