// contact model for Connecto

const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
    {
       number: {
            type: String,
            trim: true,
            default: null,
            match: [/^\+?\d{7,15}$/, "Please enter a valid phone number"], 
        },

        createdBy:[{
            userId:{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            name: String,
            isBlock:{type:Boolean, default:false},
        }]
       
    },
    { timestamps: true }
);

module.exports = mongoose.model("Contact", contactSchema);
