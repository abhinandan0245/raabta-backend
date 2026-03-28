

// const http = require("http");
// const { Server } = require("socket.io");
// const app = require("./app");
// const connectDB = require("./config/db");
// const dotenv = require("dotenv");
// const socketHandler = require("./sockets");

// dotenv.config();
// connectDB();

// const server = http.createServer(app);

// // socket 

// const io = new Server(server, {
//     cors: {
//         origin: process.env.CLIENT_URL || "http://localhost:5173" || "http://localhost:5174",
//         methods: ["GET", "POST"],
//     },
// });

// // Modular socket handling
// socketHandler(io);

// const PORT = process.env.PORT || 4000;
// server.listen(PORT, () => console.log(`Server running on port ${PORT}`));



const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const connectDB = require("./config/db");
const dotenv = require("dotenv");
const socketHandler = require("./sockets");

dotenv.config();
connectDB();

const server = http.createServer(app);

// Make io globally accessible
global.io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:5173" || "http://localhost:5174" || "http://localhost:5175",
        methods: ["GET", "POST"],
    },
});

// Modular socket handling
socketHandler(global.io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));