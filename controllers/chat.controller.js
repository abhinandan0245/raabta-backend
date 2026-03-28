const Chat = require("../models/chat.model");
const User = require("../models/user.model");
const Contact = require("../models/contact.model");
const Message = require("../models/message.model");

// Create or fetch 1-to-1 chat from User ID
exports.accessChat = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ 
                success: false,
                message: "User ID is required" 
            });
        }

        // Check if target user exists
        const targetUser = await User.findById(userId).select("-password");
        if (!targetUser) {
            return res.status(404).json({ 
                success: false,
                message: "User not found" 
            });
        }

        // Check if chat already exists between these users
        let chat = await Chat.findOne({
            isGroupChat: false,
            users: { 
                $all: [req.user._id, userId],
                $size: 2
            }
        })
        .populate("users", "name email avatar number isOnline lastSeen")
        .populate({
            path: "latestMessage",
            populate: {
                path: "sender",
                select: "name avatar"
            }
        })
        .populate("customNames.userId", "name");

        if (chat) {
            // Emit socket event for chat opened (typing indicator reset)
            if (global.io) {
                global.io.to(chat._id.toString()).emit("chat_opened", {
                    chatId: chat._id,
                    userId: req.user._id
                });
            }

            return res.status(200).json({
                success: true,
                chat: {
                    ...chat.toObject(),
                    displayName: targetUser.name,
                    otherUser: targetUser
                }
            });
        }

        // Create new chat
        const newChat = await Chat.create({
            chatName: "private",
            isGroupChat: false,
            users: [req.user._id, userId],
            customNames: [
                {
                    userId: req.user._id,
                    name: req.user.name
                },
                {
                    userId: userId,
                    name: targetUser.name
                }
            ]
        });

        const fullChat = await Chat.findById(newChat._id)
            .populate("users", "name email avatar number isOnline lastSeen")
            .populate("customNames.userId", "name");

        // Emit socket event for new chat creation
        if (global.io) {
            // Join both users to the chat room
            fullChat.users.forEach(user => {
                global.io.to(user._id.toString()).emit("new_chat_created", {
                    chat: fullChat,
                    initiatedBy: req.user._id
                });
            });
        }

        return res.status(201).json({
            success: true,
            chat: {
                ...fullChat.toObject(),
                displayName: targetUser.name,
                otherUser: targetUser
            }
        });
        
    } catch (error) {
        console.error("Access chat error:", error);
        return res.status(500).json({ 
            success: false,
            message: "Server error", 
            error: error.message 
        });
    }
};

// Create or get chat from contact
exports.accessChatFromContact = async (req, res) => {
    try {
        const { contactId } = req.body;

        if (!contactId) {
            return res.status(400).json({ 
                success: false,
                message: "Contact ID is required" 
            });
        }

        const contact = await Contact.findById(contactId);
        
        if (!contact) {
            return res.status(404).json({ 
                success: false,
                message: "Contact not found" 
            });
        }

        // Find the user who owns this number
        const targetUser = await User.findOne({ 
            number: contact.number,
            _id: { $ne: req.user._id }
        });

        if (!targetUser) {
            return res.status(404).json({ 
                success: false,
                message: "User with this number not found" 
            });
        }

        // Check if chat already exists
        let chat = await Chat.findOne({
            isGroupChat: false,
            users: { 
                $all: [req.user._id, targetUser._id],
                $size: 2
            }
        })
        .populate("users", "name email avatar number isOnline lastSeen")
        .populate({
            path: "latestMessage",
            populate: {
                path: "sender",
                select: "name avatar"
            }
        });

        if (chat) {
            // Emit socket event
            if (global.io) {
                global.io.to(chat._id.toString()).emit("chat_opened", {
                    chatId: chat._id,
                    userId: req.user._id
                });
            }

            return res.status(200).json({
                success: true,
                chat: {
                    ...chat.toObject(),
                    contactName: contact.createdBy.find(
                        c => String(c.userId) === String(req.user._id)
                    )?.name || targetUser.name,
                    otherUser: targetUser
                }
            });
        }

        // Create new chat
        const newChat = await Chat.create({
            chatName: "private",
            isGroupChat: false,
            users: [req.user._id, targetUser._id]
        });

        const fullChat = await Chat.findById(newChat._id)
            .populate("users", "name email avatar number isOnline lastSeen");

        // Emit socket event
        if (global.io) {
            fullChat.users.forEach(user => {
                global.io.to(user._id.toString()).emit("new_chat_created", {
                    chat: fullChat,
                    initiatedBy: req.user._id
                });
            });
        }

        return res.status(201).json({
            success: true,
            chat: {
                ...fullChat.toObject(),
                contactName: contact.createdBy.find(
                    c => String(c.userId) === String(req.user._id)
                )?.name || targetUser.name,
                otherUser: targetUser
            }
        });

    } catch (error) {
        console.error("Access chat from contact error:", error);
        return res.status(500).json({ 
            success: false,
            message: "Server error", 
            error: error.message 
        });
    }
};

// Fetch chats for user
exports.fetchChats = async (req, res) => {
    try {
        let chats = await Chat.find({ 
            users: { $elemMatch: { $eq: req.user._id } },
            isActive: true
        })
        .populate("users", "name email avatar number isOnline lastSeen")
        .populate("groupAdmin", "name email avatar")
        .populate({
            path: "latestMessage",
            populate: {
                path: "sender",
                select: "name avatar"
            }
        })
        .sort({ updatedAt: -1 })
        .lean();

        // Get all contacts to find saved names
        const contacts = await Contact.find({ 
            "createdBy.userId": req.user._id 
        })
        .populate('createdBy.userId', 'name avatar number')
        .lean();

        // Process each chat
        chats = chats.map(chat => {
            const chatObj = { ...chat };
            
            if (!chat.isGroupChat && chat.users && chat.users.length === 2) {
                const otherUser = chat.users.find(
                    user => String(user._id) !== String(req.user._id)
                );
                
                if (otherUser) {
                    chatObj.otherUser = otherUser;
                    
                    const matchingContact = contacts.find(
                        contact => contact.number === otherUser.number
                    );
                    
                    if (matchingContact) {
                        const userEntry = matchingContact.createdBy.find(
                            entry => String(entry.userId?._id) === String(req.user._id)
                        );
                        
                        if (userEntry?.name) {
                            chatObj.contactName = userEntry.name;
                            chatObj.isContactChat = true;
                            chatObj.contactId = matchingContact._id;
                        }
                    }
                    
                    chatObj.displayName = chatObj.contactName || otherUser.name;
                }
            } else if (chat.isGroupChat) {
                chatObj.displayName = chat.chatName || "Group Chat";
            }

            return chatObj;
        });

        // Emit socket event for online status
        if (global.io) {
            chats.forEach(chat => {
                global.io.to(chat._id.toString()).emit("user_online_status", {
                    userId: req.user._id,
                    isOnline: true
                });
            });
        }

        return res.status(200).json({
            success: true,
            chats,
            count: chats.length
        });
        
    } catch (error) {
        console.error("Fetch chats error:", error);
        return res.status(500).json({ 
            success: false,
            message: "Server error", 
            error: error.message 
        });
    }
};

// Create group chat
exports.createGroupChat = async (req, res) => {
    try {
        const { name, users, chatImage } = req.body;

        if (!name || !users || !Array.isArray(users) || users.length < 2) {
            return res.status(400).json({ 
                success: false,
                message: "Please provide valid group name and at least 2 users" 
            });
        }

        // Validate all users exist
        const validUsers = await User.find({
            _id: { $in: users }
        }).select("_id");

        if (validUsers.length !== users.length) {
            return res.status(400).json({ 
                success: false,
                message: "Some users are invalid" 
            });
        }

        // Add current user to the group
        const allUsers = [...new Set([...users, req.user._id.toString()])];

        const groupChat = await Chat.create({
            chatName: name.trim(),
            users: allUsers,
            isGroupChat: true,
            groupAdmin: req.user._id,
            chatImage: chatImage || null
        });

        const fullGroupChat = await Chat.findById(groupChat._id)
            .populate("users", "name email avatar number")
            .populate("groupAdmin", "name email avatar");

        // Emit socket event to all group members
        if (global.io) {
            fullGroupChat.users.forEach(user => {
                global.io.to(user._id.toString()).emit("group_created", {
                    group: fullGroupChat,
                    createdBy: req.user._id
                });
                
                // Also join them to the group room
                global.io.to(user._id.toString()).emit("join_group", {
                    groupId: fullGroupChat._id
                });
            });
        }

        return res.status(201).json({
            success: true,
            message: "Group created successfully",
            chat: fullGroupChat
        });
        
    } catch (error) {
        console.error("Create group error:", error);
        return res.status(500).json({ 
            success: false,
            message: "Server error", 
            error: error.message 
        });
    }
};

// Update group info
exports.updateGroupChat = async (req, res) => {
    try {
        const { chatId } = req.params;
        const { name, users, chatImage } = req.body;

        const chat = await Chat.findById(chatId);
        
        if (!chat || !chat.isGroupChat) {
            return res.status(404).json({ 
                success: false,
                message: "Group not found" 
            });
        }

        // Check if user is admin
        if (String(chat.groupAdmin) !== String(req.user._id)) {
            return res.status(403).json({ 
                success: false,
                message: "Only group admin can update" 
            });
        }

        if (name) chat.chatName = name.trim();
        if (chatImage) chat.chatImage = chatImage;
        
        if (users && Array.isArray(users)) {
            // Add new users
            const newUsers = [...new Set([...chat.users.map(u => u.toString()), ...users])];
            
            // Find added users
            const addedUsers = newUsers.filter(userId => 
                !chat.users.includes(userId)
            );
            
            chat.users = newUsers;

            // Emit socket event for added users
            if (global.io && addedUsers.length > 0) {
                addedUsers.forEach(userId => {
                    global.io.to(userId).emit("added_to_group", {
                        groupId: chatId,
                        addedBy: req.user._id,
                        groupName: name || chat.chatName
                    });
                });
            }
        }

        await chat.save();
        
        const updatedChat = await Chat.findById(chatId)
            .populate("users", "name email avatar number")
            .populate("groupAdmin", "name email avatar");

        // Emit socket event to all group members
        if (global.io) {
            global.io.to(chatId).emit("group_updated", {
                group: updatedChat,
                updatedBy: req.user._id
            });
        }

        return res.json({
            success: true,
            message: "Group updated successfully",
            chat: updatedChat
        });
        
    } catch (error) {
        return res.status(500).json({ 
            success: false,
            message: "Server error", 
            error: error.message 
        });
    }
};

// Leave group
exports.leaveGroup = async (req, res) => {
    try {
        const { chatId } = req.params;

        const chat = await Chat.findById(chatId);
        
        if (!chat || !chat.isGroupChat) {
            return res.status(404).json({ 
                success: false,
                message: "Group not found" 
            });
        }

        // Remove user from group
        const userIdStr = req.user._id.toString();
        chat.users = chat.users.filter(
            userId => String(userId) !== userIdStr
        );

        // If no users left, delete the group
        if (chat.users.length === 0) {
            await Chat.findByIdAndDelete(chatId);
            
            // Emit socket event
            if (global.io) {
                global.io.to(chatId).emit("group_deleted", {
                    groupId: chatId,
                    deletedBy: req.user._id
                });
            }
            
            return res.json({
                success: true,
                message: "Group deleted"
            });
        }

        // If admin is leaving, assign new admin
        if (String(chat.groupAdmin) === userIdStr) {
            chat.groupAdmin = chat.users[0];
        }

        await chat.save();

        // Emit socket events
        if (global.io) {
            // Notify user who left
            global.io.to(userIdStr).emit("left_group", {
                groupId: chatId
            });
            
            // Notify remaining group members
            global.io.to(chatId).emit("user_left_group", {
                groupId: chatId,
                userId: req.user._id,
                newAdmin: chat.groupAdmin
            });
        }

        return res.json({
            success: true,
            message: "Left group successfully"
        });
        
    } catch (error) {
        return res.status(500).json({ 
            success: false,
            message: "Server error", 
            error: error.message 
        });
    }
};

// Add contact and create chat
exports.addContactAndCreateChat = async (req, res) => {
    try {
        const { number, name } = req.body;

        if (!number || !name) {
            return res.status(400).json({
                success: false,
                message: "Number and name are required."
            });
        }

        // Check if user with this number exists
        const userWithNumber = await User.findOne({ 
            number: { $eq: number, $ne: null } 
        });

        if (!userWithNumber) {
            return res.status(404).json({
                success: false,
                message: "No user found with this number. Please ask them to register first.",
            });
        }

        if (userWithNumber._id.toString() === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: "Cannot add your own number as contact.",
            });
        }

        // Check if contact already exists
        let contact = await Contact.findOne({ number });

        let isNewContact = false;
        
        if (contact) {
            const alreadyExists = contact.createdBy.some(
                c => String(c.userId) === String(req.user._id)
            );

            if (alreadyExists) {
                return res.status(400).json({
                    success: false,
                    message: "You have already saved this contact.",
                });
            }

            contact.createdBy.push({
                userId: req.user._id,
                name,
                isBlock: false
            });

            await contact.save();
        } else {
            contact = await Contact.create({
                number,
                createdBy: [{
                    userId: req.user._id,
                    name,
                    isBlock: false
                }],
            });
            isNewContact = true;
        }

        // Check if chat already exists
        let chat = await Chat.findOne({
            isGroupChat: false,
            users: { 
                $all: [req.user._id, userWithNumber._id],
                $size: 2
            }
        })
        .populate("users", "name email avatar number isOnline lastSeen")
        .populate({
            path: "latestMessage",
            populate: {
                path: "sender",
                select: "name avatar"
            }
        });

        let isNewChat = false;
        
        if (!chat) {
            chat = await Chat.create({
                chatName: "private",
                isGroupChat: false,
                users: [req.user._id, userWithNumber._id],
            });

            isNewChat = true;
            
            chat = await Chat.findById(chat._id)
                .populate("users", "name email avatar number isOnline lastSeen");

            // Emit socket event for new chat
            if (global.io) {
                chat.users.forEach(user => {
                    global.io.to(user._id.toString()).emit("new_chat_created", {
                        chat,
                        initiatedBy: req.user._id
                    });
                });
            }
        }

        // Prepare response
        const response = {
            success: true,
            message: isNewContact ? 
                "Contact added and chat created successfully" : 
                "Contact added to existing number and chat fetched",
            data: {
                contact: {
                    _id: contact._id,
                    number: contact.number,
                    savedName: name,
                    isNew: isNewContact
                },
                chat: {
                    ...chat.toObject(),
                    displayName: userWithNumber.name,
                    otherUser: userWithNumber,
                    isNew: isNewChat
                },
                user: {
                    _id: userWithNumber._id,
                    name: userWithNumber.name,
                    avatar: userWithNumber.avatar,
                    number: userWithNumber.number
                }
            }
        };

        return res.status(isNewChat ? 201 : 200).json(response);

    } catch (error) {
        console.error("Add contact and create chat error:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Server error",
            error: error.message 
        });
    }
};

// Get contact with chat info
exports.getContactWithChat = async (req, res) => {
    try {
        const { contactId } = req.params;

        const contact = await Contact.findById(contactId)
            .populate('createdBy.userId', 'name email avatar number');

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: "Contact not found"
            });
        }

        const userEntry = contact.createdBy.find(
            entry => String(entry.userId._id) === String(req.user._id)
        );

        if (!userEntry) {
            return res.status(403).json({
                success: false,
                message: "You don't have access to this contact"
            });
        }

        const targetUser = await User.findOne({
            number: contact.number,
            _id: { $ne: req.user._id }
        });

        let chat = null;
        let chatInfo = null;

        if (targetUser) {
            chat = await Chat.findOne({
                isGroupChat: false,
                users: {
                    $all: [req.user._id, targetUser._id],
                    $size: 2
                }
            })
            .populate("users", "name email avatar number")
            .populate({
                path: "latestMessage",
                populate: {
                    path: "sender",
                    select: "name avatar"
                }
            })
            .lean();

            if (chat) {
                chatInfo = {
                    _id: chat._id,
                    users: chat.users,
                    latestMessage: chat.latestMessage,
                    createdAt: chat.createdAt,
                    updatedAt: chat.updatedAt
                };
            }
        }

        const response = {
            success: true,
            data: {
                contact: {
                    _id: contact._id,
                    number: contact.number,
                    savedName: userEntry.name,
                    isBlocked: userEntry.isBlock || false,
                    createdAt: contact.createdAt,
                    updatedAt: contact.updatedAt
                },
                user: targetUser ? {
                    _id: targetUser._id,
                    name: targetUser.name,
                    avatar: targetUser.avatar,
                    number: targetUser.number,
                    isOnline: targetUser.isOnline,
                    lastSeen: targetUser.lastSeen
                } : null,
                chat: chatInfo,
                hasChat: !!chatInfo,
                canCreateChat: !!targetUser && !chatInfo
            }
        };

        return res.json(response);

    } catch (error) {
        console.error("Get contact with chat error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

// Get contacts with chats
exports.getContactsWithChats = async (req, res) => {
    try {
        const allContacts = await Contact.find({ 
            "createdBy.userId": req.user._id 
        })
        .populate('createdBy.userId', 'name avatar number isOnline lastSeen')
        .lean();

        const allChats = await Chat.find({ 
            users: { $elemMatch: { $eq: req.user._id } },
            isGroupChat: false,
            isActive: true
        })
        .populate("users", "name avatar number")
        .populate("latestMessage")
        .lean();

        const contactsWithChats = allContacts.map(contact => {
            const userEntry = contact.createdBy.find(
                entry => String(entry.userId._id) === String(req.user._id)
            );
            
            const chat = allChats.find(c => {
                const otherUser = c.users.find(
                    u => String(u._id) !== String(req.user._id)
                );
                return otherUser && otherUser.number === contact.number;
            });

            return {
                _id: contact._id,
                number: contact.number,
                savedName: userEntry?.name || "Unknown",
                isBlocked: userEntry?.isBlock || false,
                hasChat: !!chat,
                chat: chat ? {
                    _id: chat._id,
                    latestMessage: chat.latestMessage,
                    updatedAt: chat.updatedAt,
                    users: chat.users
                } : null,
                createdAt: contact.createdAt,
                updatedAt: contact.updatedAt
            };
        });

        return res.status(200).json({
            success: true,
            contacts: contactsWithChats,
            count: contactsWithChats.length
        });

    } catch (error) {
        console.error("Get contacts with chats error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

// Typing indicator
exports.typingIndicator = async (req, res) => {
    try {
        const { chatId, isTyping } = req.body;

        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({
                success: false,
                message: "Chat not found"
            });
        }

        // Emit socket event
        if (global.io) {
            if (isTyping) {
                global.io.to(chatId).emit("typing", {
                    userId: req.user._id,
                    chatId
                });
            } else {
                global.io.to(chatId).emit("stop_typing", {
                    userId: req.user._id,
                    chatId
                });
            }
        }

        return res.json({
            success: true,
            message: isTyping ? "Typing indicator sent" : "Typing stopped"
        });
        
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};