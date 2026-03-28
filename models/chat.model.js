// chat.model.js
const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
    {
        chatName: {
            type: String,
            trim: true,
        },
        isGroupChat: {
            type: Boolean,
            default: false,
        },
        users: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },
        ],
        latestMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message",
        },
        groupAdmin: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        // Add these fields for better management
        chatImage: {
            type: String,
            default: null,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        // For 1-to-1 chats, store the custom name per user
        customNames: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User"
                },
                name: String
            }
        ]
    },
    { 
        timestamps: true,
        // Add indexes for performance
        indexes: [
            { users: 1 },
            { isGroupChat: 1, users: 1 }
        ]
    }
);

// Virtual for getting the other user in 1-to-1 chat
chatSchema.virtual('otherUser').get(function() {
    if (this.isGroupChat || this.users.length !== 2) return null;
    return this.users[1]; // Will be handled in population
});

module.exports = mongoose.model("Chat", chatSchema);