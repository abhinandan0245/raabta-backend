// Authentication controller for Connecto

const User = require("../models/user.model");
const generateToken = require("../utils/generateToken");
const getFullUrl = require("../utils/getFullUrl");


// Register user
exports.registerUser = async (req, res) => {
    try {
        const { name, email, password, number } = req.body;

        if (!name || !email || !password || !number) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: "Email already registered" });
        }

        const user = await User.create({ name, email, password, number });

        const token = generateToken(user._id);

        res
            .status(201)
            .cookie("connectoToken", token, {
                httpOnly: false,
                secure: false,
                sameSite: "lax",
            })
            .json({
                success: true,
                message: "Registration successful",
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    number: user.number,
                    avatar: user.avatar,
                },
            });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};


// Login user
exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const token = generateToken(user._id);

        res
            .status(200)
            .cookie("connectoToken", token, {
                httpOnly: false,
                secure: false,
                sameSite: "lax",
            })
            .json({
                success: true,
                message: "Login successful",
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    avatar: user.avatar,
                },
            });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Logout user
exports.logoutUser = async (req, res) => {
    res
        .cookie("connectoToken", "", {
            httpOnly: true,
            expires: new Date(0),
        })
        .json({
            success: true,
            message: "Logged out successfully",
        });
};

// Get logged-in user (protected route)
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("-password");

        res.json({
            success: true,
            user,
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Update user profile information
exports.updateProfile = async (req, res) => {
    try {
        const { name, aboutMe, number } = req.body;

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (name) user.name = name.trim();
        if (aboutMe) user.aboutMe = aboutMe.trim();
        if (number) user.number = number.trim();

        await user.save();

        res.json({
            success: true,
            message: "Profile updated successfully",
            user: {
                _id: user._id,
                name: user.name,
                aboutMe: user.aboutMe,
                email: user.email,
                number: user.number,
                avatar: user.avatar,
            },
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};



exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file || !req.file.processedFilename) {
      return res.status(400).json({ message: "No image provided" });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const filePath = `/uploads/profile/${req.file.processedFilename}`;
    const fullUrl = getFullUrl(req, filePath);
user.avatar = fullUrl; // Save full URL in DB
await user.save();

return res.json({
  success: true,
  message: "Profile image updated successfully",
  avatar: fullUrl,
});
  } catch (err) {
    console.error("Upload avatar error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};


