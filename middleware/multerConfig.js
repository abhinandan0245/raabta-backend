const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

// Make sure the folder exists
const uploadDir = "uploads/profile";
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Memory storage to allow Sharp processing
const storage = multer.memoryStorage();

// File type validation
const fileFilter = (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Only JPEG, PNG, or WebP images are allowed"), false);
    }
};

// Multer setup
const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
});

// Middleware to process image using Sharp
const processProfileImage = async (req, res, next) => {
    try {
        if (!req.file) return next();

        const ext = path.extname(req.file.originalname).toLowerCase() || ".webp";
        const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`; // save all as webp

        // Resize & compress image
        await sharp(req.file.buffer)
            .resize(300, 300) // square profile image
            .webp({ quality: 80 }) // compress to 80% quality
            .toFile(path.join(uploadDir, filename));

        // Attach filename to request so controller can save it in DB
        req.file.processedFilename = filename;

        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Image processing failed", error: err.message });
    }
};

module.exports = { upload, processProfileImage };
