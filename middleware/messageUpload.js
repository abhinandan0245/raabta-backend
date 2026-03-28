// backend/middleware/messageUpload.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Make sure the folder exists
const uploadDir = "uploads/messages";
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage for message attachments
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'msg-' + uniqueSuffix + ext);
    }
});

// File filter for messages - ALLOW PDF AND ALL FILE TYPES
const fileFilter = (req, file, cb) => {
    console.log("📎 Received file:", {
        fieldname: file.fieldname,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
    });
    
    // Allow images
    if (file.mimetype.startsWith('image/')) {
        return cb(null, true);
    }
    // Allow videos
    if (file.mimetype.startsWith('video/')) {
        return cb(null, true);
    }
    // Allow audio
    if (file.mimetype.startsWith('audio/')) {
        return cb(null, true);
    }
    // Allow PDF specifically
    if (file.mimetype === 'application/pdf') {
        return cb(null, true);
    }
    // Allow documents
    const allowedDocs = [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv',
        'application/rtf',
        'application/json',
        'application/xml'
    ];
    
    if (allowedDocs.includes(file.mimetype)) {
        return cb(null, true);
    }
    
    // If file type not allowed
    console.log("❌ File type not allowed:", file.mimetype);
    cb(new Error(`File type not supported: ${file.mimetype}`), false);
};

// Increase file size limit for videos (50MB)
const messageUpload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

module.exports = { messageUpload };