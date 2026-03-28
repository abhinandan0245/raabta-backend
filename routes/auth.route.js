// Authentication routes

const express = require("express");
const { registerUser, loginUser, logoutUser, getMe, updateProfile, uploadAvatar } = require("../controllers/user.controller");
const { protect } = require("../middleware/auth.middleware");
const { upload, processProfileImage } = require("../middleware/multerConfig");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", logoutUser);
router.get("/me", protect, getMe);
router.put("/update-profile", protect, updateProfile);
router.put(
    "/upload-avatar",
    protect,
    upload.single("avatar"),
    processProfileImage,
    uploadAvatar
);


module.exports = router;
