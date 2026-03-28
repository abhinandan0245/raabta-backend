// module.exports = (io) => {
//     io.on("connection", (socket) => {
//         console.log(`User connected: ${socket.id}`);

//         // Chat related socket events
//         require("./chat")(io, socket);

//         // Notification socket events
//         require("./notification")(io, socket);

//         // User joins their personal room for notifications
//         // ✅ SAHI HONA CHAHIYE
// socket.on("join_user", (userId) => {
//     socket.join(`user:${userId}`);  // Consistent naming convention
//     console.log(`User ${userId} joined personal room`);
// });

//         // Clean disconnect
//         socket.on("disconnect", () => {
//             console.log(`User disconnected: ${socket.id}`);
//         });
//     });
// };


// backend/sockets/index.js - Add room confirmation
module.exports = (io) => {
    io.on("connection", (socket) => {
        console.log(`🔌 User connected: ${socket.id}`);

        // Join user's personal room with proper naming
        socket.on("join_user", (userId) => {
            socket.join(`user:${userId}`);
            console.log(`👤 User ${userId} joined personal room`);
            
            // Confirm room join
            socket.emit("room_joined", { 
                userId, 
                room: `user:${userId}`,
                success: true 
            });
        });

        // Check room (for debugging)
        socket.on("check_room", ({ userId }) => {
            const rooms = Array.from(socket.rooms);
            console.log(`🔍 User ${userId} rooms:`, rooms);
            socket.emit("room_confirmed", { 
                userId, 
                rooms,
                inUserRoom: rooms.includes(`user:${userId}`)
            });
        });

        // Chat related socket events
        require("./chat")(io, socket);

        // Notification socket events
        require("./notification")(io, socket);

        // User online status
        socket.on("user_online", ({ userId, isOnline }) => {
            console.log(`🟢 User ${userId} is ${isOnline ? 'online' : 'offline'}`);
            
            // Broadcast to all connected clients
            socket.broadcast.emit("user_status_changed", {
                userId,
                isOnline,
                lastSeen: isOnline ? null : new Date()
            });
        });

        // Clean disconnect
        socket.on("disconnect", () => {
            console.log(`🔌 User disconnected: ${socket.id}`);
        });
    });
};