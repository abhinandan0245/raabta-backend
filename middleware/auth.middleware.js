// Middleware to protect routes using JWT

const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

exports.protect = async (req, res, next) => {
    try {
        const token = req.cookies.connectoToken;

        if (!token) {
            return res.status(401).json({ message: "Not authorized" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = await User.findById(decoded.id).select("-password");

        next();
    } catch (error) {
        return res.status(401).json({ message: "Token invalid or expired" });
    }
};
