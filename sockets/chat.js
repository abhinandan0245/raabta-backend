module.exports = (io, socket) => {
    
    // Join a chat room
    // socket.on("join_chat", ({ chatId, userId }) => {
    //     socket.join(`chat:${chatId}`);
    //     socket.userId = userId;

    //     console.log(`User ${userId} joined chat ${chatId}`);
        
    //     // Notify others in the chat
    //     socket.to(`chat:${chatId}`).emit("user_joined_chat", {
    //         userId,
    //         chatId,
    //         joinedAt: new Date()
    //     });
    // });


     // Join a chat room
    socket.on("join_chat", ({ chatId, userId }) => {
        socket.join(`chat:${chatId}`);
        socket.userId = userId;
        console.log(`👤 User ${userId} joined chat ${chatId}`);
        
        socket.to(`chat:${chatId}`).emit("user_joined_chat", {
            userId,
            chatId,
            joinedAt: new Date()
        });
    });

    // Send message event - Add notification creation
    socket.on("send_message", async (messageData) => {
        console.log("📨 New message via socket:", messageData.chatId);
        
        // Broadcast to chat room
        io.to(`chat:${messageData.chatId || messageData.chat}`).emit("new_message", {
            ...messageData,
            _id: messageData._id || `temp_${Date.now()}`,
            createdAt: new Date(),
        });

        // 👇 CREATE NOTIFICATIONS FOR OTHER USERS
        if (messageData.chat && messageData.chat.users) {
            const recipients = messageData.chat.users.filter(
                u => String(u) !== String(messageData.sender._id)
            );
            
            recipients.forEach(recipientId => {
                // Create notification via socket
                socket.emit("create_notification", {
                    userId: recipientId,
                    type: "message",
                    content: `New message from ${messageData.sender.name}`,
                    link: `/chat/${messageData.chatId}`
                });
            });
        }
    });

    // Leave chat room
    socket.on("leave_chat", ({ chatId }) => {
        socket.leave(`chat:${chatId}`);
        console.log(`User ${socket.userId} left chat ${chatId}`);
        
        // Notify others
        socket.to(`chat:${chatId}`).emit("user_left_chat", {
            userId: socket.userId,
            chatId
        });
    });

    // Typing indicator
    socket.on("typing", ({ chatId, userId }) => {
        socket.to(`chat:${chatId}`).emit("typing", { 
            userId,
            chatId 
        });
    });

    socket.on("stop_typing", ({ chatId, userId }) => {
        socket.to(`chat:${chatId}`).emit("stop_typing", { 
            userId,
            chatId 
        });
    });

    // Message read receipt
    socket.on("message_read", ({ messageId, chatId, readerId }) => {
        socket.to(`chat:${chatId}`).emit("message_read", {
            messageId,
            readerId,
            chatId,
            readAt: new Date()
        });
    });

    // Send message event
    socket.on("send_message", (messageData) => {
        console.log("📨 New message via socket:", messageData);
        
        // Broadcast to all in the chat room
        io.to(`chat:${messageData.chatId || messageData.chat}`).emit("new_message", {
            ...messageData,
            _id: messageData._id || `temp_${Date.now()}`,
            createdAt: new Date(),
        });
        
        console.log(`Message broadcasted to chat: ${messageData.chatId || messageData.chat}`);
    });

    // User online status
    socket.on("user_online", ({ userId, isOnline }) => {
        console.log(`User ${userId} is ${isOnline ? 'online' : 'offline'}`);
        
        // Store online status
        global.onlineUsers = global.onlineUsers || {};
        
        if (isOnline) {
            global.onlineUsers[userId] = {
                socketId: socket.id,
                lastSeen: null
            };
        } else {
            if (global.onlineUsers[userId]) {
                global.onlineUsers[userId].lastSeen = new Date();
            }
        }
        
        // Broadcast to all connected clients
        io.emit("user_status_changed", {
            userId,
            isOnline,
            lastSeen: isOnline ? null : new Date()
        });
        
        console.log(`User status broadcasted for: ${userId}`);
    });

    // Listen for chat marked as read
    socket.on("chat_marked_read", ({ chatId, readerId }) => {
        console.log(`Chat ${chatId} marked as read by ${readerId}`);
        
        // Notify others in the chat
        socket.to(`chat:${chatId}`).emit("chat_marked_read", {
            chatId,
            readerId,
            readAt: new Date()
        });
        
        // Update unread count for the reader
        io.to(`user:${readerId}`).emit("unread_count_updated", {
            chatId,
            unreadCount: 0
        });
    });

    // Listen for unread count updates
    socket.on("update_unread_count", ({ chatId, userId, count }) => {
        console.log(`Updating unread count for user ${userId} in chat ${chatId}: ${count}`);
        
        io.to(`user:${userId}`).emit("unread_count_updated", {
            chatId,
            unreadCount: count
        });
    });

    // Handle user joining personal room
    socket.on("join_user", (userId) => {
        socket.join(`user:${userId}`);
        console.log(`User ${userId} joined personal room`);
    });

};