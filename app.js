// Express application setup and core middlewares

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/auth.route");
const chatRoutes = require("./routes/chat.route");
const messageRoutes = require("./routes/message.route");
const notificationRoutes = require("./routes/notification.route");
const contactRoutes = require("./routes/contact.routes");
const path = require("path")

const app = express();

// Core middlewares
const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);
app.use("/api/notification", notificationRoutes);
app.use("/api/contact", contactRoutes);


// Serve uploads folder as static
// Serve profile images
// app.use("/uploads/profile", express.static(path.join(__dirname, "uploads/profile")));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// API routes placeholder
app.get("/", (req, res) => {
    res.send("Connecto backend running");
});

// Exporting the app for server.js
module.exports = app;
