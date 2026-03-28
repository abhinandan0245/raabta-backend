// message.model.js
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      trim: true,
      default: ""
    },
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
      index: true // Add index for faster queries
    },
    attachments: [
      {
        url: String,
        type: {
          type: String,
          enum: ["image", "video", "document", "audio", "pdf"],
          default: "image"
        },
        filename: String,
        size: Number
      }
    ],
    // For message status tracking
    readBy: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      readAt: {
        type: Date,
        default: Date.now
      }
    }],
    deliveredTo: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }],
    isEdited: {
      type: Boolean,
      default: false
    },
    editedAt: Date,
    // For message reactions
    reactions: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      emoji: String,
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    // For reply functionality
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message"
    },
    // For message deletion
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedFor: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }]
  },
  { 
    timestamps: true,
    // Optimize queries
    indexes: [
      { chat: 1, createdAt: -1 }, // For fetching messages by chat
      { sender: 1 },
      { "readBy.userId": 1 }
    ]
  }
);

module.exports = mongoose.model("Message", messageSchema);