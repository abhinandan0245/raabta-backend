const Message = require("../models/message.model");
const Chat = require("../models/chat.model");
const User = require("../models/user.model");

// Send new message
// backend/controllers/message.controller.js
// backend/controllers/message.controller.js
exports.sendMessage = async (req, res) => {
  try {
    const { chatId, content } = req.body;
    let attachments = [];

    console.log("📨 Received message request:", {
      chatId,
      content: content?.substring(0, 50),
      files: req.files?.length || 0,
      user: req.user?._id
    });

    // Log files if present
    if (req.files && req.files.length > 0) {
      console.log("📎 Files received:", req.files.map(f => ({
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
        filename: f.filename
      })));
    }

    // Handle file uploads from multer
// In the part where you process attachments
if (req.files && req.files.length > 0) {
  attachments = req.files.map(file => {
    // Determine file type category
    let fileType = 'document';
    
    if (file.mimetype.startsWith('image/')) {
      fileType = 'image';
    } else if (file.mimetype.startsWith('video/')) {
      fileType = 'video';
    } else if (file.mimetype.startsWith('audio/')) {
      fileType = 'audio';
    } else if (file.mimetype === 'application/pdf') {
      fileType = 'pdf'; // Explicitly set PDF type
    }
    
    return {
      url: `/uploads/messages/${file.filename}`,
      type: fileType,
      filename: file.originalname,
      size: file.size,
      mimeType: file.mimetype
    };
  });
  console.log("✅ Processed attachments:", attachments);
}

    if (!chatId) {
      return res.status(400).json({ 
        success: false,
        message: "Chat ID is required." 
      });
    }

    // Check if chat exists and user is part of it
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ 
        success: false,
        message: "Chat not found" 
      });
    }

    // Check if user is part of this chat
    const isMember = chat.users.some(
      userId => String(userId) === String(req.user._id)
    );
    
    if (!isMember) {
      return res.status(403).json({ 
        success: false,
        message: "You are not a member of this chat" 
      });
    }

    // Validate message content
    if (!content?.trim() && attachments.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Message content or attachment is required.",
      });
    }

    // Create new message
    const newMessage = await Message.create({
      sender: req.user._id,
      content: content?.trim() || "",
      chat: chatId,
      attachments: attachments,
      deliveredTo: [req.user._id],
      readBy: [{
        userId: req.user._id,
        readAt: new Date()
      }]
    });

    console.log("✅ Message created:", newMessage._id);

    // Update chat's latest message
    await Chat.findByIdAndUpdate(
      chatId,
      { 
        latestMessage: newMessage._id,
        updatedAt: new Date()
      }
    );

    // Populate message data
    const fullMessage = await Message.findById(newMessage._id)
      .populate("sender", "name email avatar number")
      .populate("chat")
      .populate("replyTo")
      .lean();

    // Prepare socket event data
    const socketMessage = {
      ...fullMessage,
      chatInfo: {
        _id: chat._id,
        isGroupChat: chat.isGroupChat,
        users: chat.users,
        chatName: chat.chatName
      }
    };

    // Emit socket event to all users in the chat
    if (global.io) {
      console.log("📡 Emitting socket events for message");
      chat.users.forEach(userId => {
        global.io.to(`chat:${chatId}`).emit("message_received", socketMessage);
        
        if (String(userId) !== String(req.user._id)) {
          global.io.to(`user:${userId}`).emit("new_unread_message", {
            chatId,
            messageId: newMessage._id,
            sender: req.user._id,
            unreadCount: 1
          });
        }
      });
    }

    return res.status(201).json({
      success: true,
      message: "Message sent successfully.",
      data: socketMessage
    });
    
  } catch (error) {
    console.error("❌ Send message error:", error);
    
    // Check for multer errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: "File too large. Max size is 20MB."
      });
    }
    
    if (error.message && error.message.includes('File type not supported')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Get messages for a chat
exports.getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Validate chat exists and user is member
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ 
        success: false,
        message: "Chat not found" 
      });
    }

    const isMember = chat.users.some(
      userId => String(userId) === String(req.user._id)
    );
    
    if (!isMember) {
      return res.status(403).json({ 
        success: false,
        message: "You are not a member of this chat" 
      });
    }

    const skip = (page - 1) * limit;

    // Get messages with pagination
    const messages = await Message.find({ 
      chat: chatId,
      isDeleted: false,
      $or: [
        { deletedFor: { $ne: req.user._id } },
        { deletedFor: { $exists: false } }
      ]
    })
    .populate("sender", "name email avatar number")
    .populate("readBy.userId", "name avatar")
    .populate({
      path: "replyTo",
      populate: {
        path: "sender",
        select: "name avatar"
      }
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

    // Reverse for chronological order (oldest first)
    const chronologicalMessages = messages.reverse();

    // Mark messages as read
    const unreadMessages = messages.filter(msg => 
      !msg.readBy?.some(r => String(r.userId?._id) === String(req.user._id))
    );

    if (unreadMessages.length > 0) {
      await Message.updateMany(
        {
          _id: { $in: unreadMessages.map(msg => msg._id) },
          "readBy.userId": { $ne: req.user._id }
        },
        {
          $push: {
            readBy: {
              userId: req.user._id,
              readAt: new Date()
            }
          }
        }
      );

      // Emit read receipt socket event
      if (global.io && unreadMessages.length > 0) {
        unreadMessages.forEach(msg => {
          global.io.to(`chat:${chatId}`).emit("message_read", {
            messageId: msg._id,
            readerId: req.user._id,
            chatId: chatId
          });
        });
        
        // Emit unread count update
        global.io.to(`user:${req.user._id}`).emit("chat_marked_read", {
          chatId,
          readerId: req.user._id,
          unreadCount: 0
        });
      }
    }

    const totalMessages = await Message.countDocuments({ 
      chat: chatId,
      isDeleted: false,
      $or: [
        { deletedFor: { $ne: req.user._id } },
        { deletedFor: { $exists: false } }
      ]
    });

    const totalPages = Math.ceil(totalMessages / limit);

    return res.status(200).json({
      success: true,
      messages: chronologicalMessages,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalMessages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      chatInfo: {
        _id: chat._id,
        isGroupChat: chat.isGroupChat,
        chatName: chat.chatName,
        users: chat.users
      }
    });
    
  } catch (error) {
    console.error("Get messages error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Get unread message count for a chat
exports.getUnreadCount = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const unreadCount = await Message.countDocuments({
      chat: chatId,
      sender: { $ne: userId }, // Not sent by current user
      readBy: { $not: { $elemMatch: { userId: userId } } }, // Not read by current user
      isDeleted: false,
      $or: [
        { deletedFor: { $ne: userId } },
        { deletedFor: { $exists: false } }
      ]
    });

    res.json({ 
      success: true, 
      unreadCount,
      chatId 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// Get unread counts for all chats
exports.getAllUnreadCounts = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all chats user is member of
    const userChats = await Chat.find({ 
      users: userId 
    }).select("_id");

    const chatIds = userChats.map(chat => chat._id);

    // Get unread counts for all chats
    const unreadCounts = {};
    
    for (const chatId of chatIds) {
      const count = await Message.countDocuments({
        chat: chatId,
        sender: { $ne: userId },
        readBy: { $not: { $elemMatch: { userId: userId } } },
        isDeleted: false,
        $or: [
          { deletedFor: { $ne: userId } },
          { deletedFor: { $exists: false } }
        ]
      });
      
      unreadCounts[chatId] = count;
    }

    res.json({ 
      success: true, 
      unreadCounts 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// Mark messages as read for a chat
exports.markChatAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    // Find all unread messages in this chat
    const unreadMessages = await Message.find({
      chat: chatId,
      sender: { $ne: userId },
      readBy: { $not: { $elemMatch: { userId: userId } } },
      isDeleted: false,
      $or: [
        { deletedFor: { $ne: userId } },
        { deletedFor: { $exists: false } }
      ]
    });

    // Mark each message as read
    if (unreadMessages.length > 0) {
      await Message.updateMany(
        {
          _id: { $in: unreadMessages.map(msg => msg._id) },
          "readBy.userId": { $ne: userId }
        },
        {
          $push: {
            readBy: {
              userId: userId,
              readAt: new Date()
            }
          }
        }
      );
    }

    // Emit socket event for real-time update
    if (global.io) {
      // Notify chat room
      global.io.to(`chat:${chatId}`).emit('chat_marked_read', {
        chatId,
        readerId: userId,
        count: unreadMessages.length
      });
      
      // Notify user specifically
      global.io.to(`user:${userId}`).emit('unread_count_updated', {
        chatId,
        unreadCount: 0
      });
    }

    res.json({ 
      success: true, 
      message: 'Messages marked as read',
      count: unreadMessages.length,
      chatId 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// Mark specific messages as read
exports.markMessagesAsRead = async (req, res) => {
  try {
    const { messageIds } = req.body;
    const userId = req.user._id;

    if (!messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({
        success: false,
        message: "Message IDs array is required"
      });
    }

    // Get chat ID from first message
    const firstMessage = await Message.findById(messageIds[0]);
    if (!firstMessage) {
      return res.status(404).json({
        success: false,
        message: "Messages not found"
      });
    }

    const chatId = firstMessage.chat;

    await Message.updateMany(
      {
        _id: { $in: messageIds },
        "readBy.userId": { $ne: userId }
      },
      {
        $push: {
          readBy: {
            userId: userId,
            readAt: new Date()
          }
        }
      }
    );

    // Emit socket event for read receipts
    if (global.io) {
      messageIds.forEach(messageId => {
        global.io.to(`chat:${chatId}`).emit("message_read", {
          messageId,
          readerId: userId,
          chatId
        });
      });
      
      // Update unread count
      const remainingUnread = await Message.countDocuments({
        chat: chatId,
        sender: { $ne: userId },
        readBy: { $not: { $elemMatch: { userId: userId } } }
      });
      
      global.io.to(`user:${userId}`).emit('unread_count_updated', {
        chatId,
        unreadCount: remainingUnread
      });
    }

    return res.json({
      success: true,
      message: "Messages marked as read"
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Delete message (soft delete)
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { deleteForEveryone } = req.body;

    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    const chatId = message.chat;
    
    // Check if user is sender
    const isSender = String(message.sender) === String(req.user._id);

    if (!isSender && !deleteForEveryone) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own messages"
      });
    }

    if (deleteForEveryone && isSender) {
      // Delete for everyone
      message.isDeleted = true;
      await message.save();

      // Emit socket event
      if (global.io) {
        global.io.to(`chat:${chatId}`).emit("message_deleted", {
          messageId,
          deletedBy: req.user._id,
          deleteForEveryone: true,
          chatId
        });
      }
    } else {
      // Delete only for this user
      if (!message.deletedFor.includes(req.user._id)) {
        message.deletedFor.push(req.user._id);
        await message.save();

        // Emit socket event for personal deletion
        if (global.io) {
          global.io.to(`user:${req.user._id}`).emit("message_deleted", {
            messageId,
            deletedBy: req.user._id,
            deleteForEveryone: false,
            chatId
          });
        }
      }
    }

    return res.json({
      success: true,
      message: deleteForEveryone ? 
        "Message deleted for everyone" : 
        "Message deleted for you"
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Edit message
exports.editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Content is required"
      });
    }

    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found"
      });
    }

    // Check if user is sender
    if (String(message.sender) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own messages"
      });
    }

    message.content = content.trim();
    message.isEdited = true;
    message.editedAt = new Date();
    
    await message.save();

    const updatedMessage = await Message.findById(messageId)
      .populate("sender", "name email avatar number")
      .lean();

    // Emit socket event for message edit
    if (global.io) {
      global.io.to(`chat:${message.chat}`).emit("message_edited", {
        messageId,
        content: content.trim(),
        editedAt: new Date(),
        editedBy: req.user._id,
        chatId: message.chat
      });
    }

    return res.json({
      success: true,
      message: "Message updated",
      data: updatedMessage
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Online status update
exports.updateOnlineStatus = async (req, res) => {
  try {
    const { isOnline } = req.body;
    
    // Update user's online status
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { 
        isOnline,
        lastSeen: isOnline ? null : new Date()
      },
      { new: true }
    ).select("name avatar number isOnline lastSeen");

    // Emit socket event to all user's chats
    if (global.io) {
      // Get all chats where user is a member
      const userChats = await Chat.find({ users: req.user._id });
      
      userChats.forEach(chat => {
        global.io.to(`chat:${chat._id}`).emit("user_status_changed", {
          userId: req.user._id,
          isOnline,
          lastSeen: user.lastSeen,
          chatId: chat._id
        });
      });
    }

    return res.json({
      success: true,
      message: `Status updated to ${isOnline ? 'online' : 'offline'}`,
      data: user
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};