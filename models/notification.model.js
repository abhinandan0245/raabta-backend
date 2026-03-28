const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        type: {
            type: String,
            required: true, // e.g., "message", "friend_request", etc.
        },
        content: {
            type: String,
            required: true,
        },
        isRead: {
            type: Boolean,
            default: false,
        },
        link: {
            type: String, // optional URL or chatId for navigation
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
