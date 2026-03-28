const Contact = require("../models/contact.model");
const User = require("../models/user.model");

// Add contact (only if number exists in User collection)
exports.addContact = async (req, res) => {
  try {
    const { number, name } = req.body;

    // Validate required fields
    if (!number || !name) {
      return res.status(400).json({
        success: false,
        message: "Number and name are required.",
      });
    }

    // Find user with this number (must exist in User collection)
    const userWithNumber = await User.findOne({ 
      number: { $eq: number, $ne: null } 
    });

    if (!userWithNumber) {
      return res.status(404).json({
        success: false,
        message: "No user found with this number. Please ask them to register first.",
      });
    }

    // Check if current user is trying to add themselves
    if (userWithNumber._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot add your own number as contact.",
      });
    }

    // Check if contact already exists with this number
    let contact = await Contact.findOne({ number });

    if (contact) {
      // Check if current user already saved this contact
      const alreadyExists = contact.createdBy.some(
        c => String(c.userId) === String(req.user._id)
      );

      if (alreadyExists) {
        return res.status(400).json({
          success: false,
          message: "You have already saved this contact.",
        });
      }

      // Add current user to createdBy array
      contact.createdBy.push({
        userId: req.user._id,
        name,
        isBlock: false
      });

      await contact.save();
      
      // Populate user info
      await contact.populate('createdBy.userId', 'name email avatar number');
      
      return res.status(200).json({
        success: true,
        message: "Contact added successfully.",
        contact,
      });
    }

    // Create new contact (number doesn't exist in Contact collection yet)
    contact = await Contact.create({
      number,
      createdBy: [{
        userId: req.user._id,
        name,
        isBlock: false
      }],
    });

    // Populate the created user info
    await contact.populate('createdBy.userId', 'name email avatar number');

    return res.status(201).json({
      success: true,
      message: "Contact added successfully.",
      contact,
    });

  } catch (error) {
    console.error("Add contact error:", error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || "Internal server error" 
    });
  }
};

// Update contact
exports.updateContact = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body; // Remove number from update - should not change

    const contact = await Contact.findById(id);
    if (!contact) {
      return res.status(404).json({ 
        success: false,
        message: "Contact not found" 
      });
    }

    // Find current user's entry in createdBy
    const entry = contact.createdBy.find(
      c => String(c.userId) === String(req.user._id)
    );

    if (!entry) {
      return res.status(403).json({ 
        success: false,
        message: "You cannot update this contact" 
      });
    }

    // Update only the name
    if (name) entry.name = name.trim();

    await contact.save();
    
    // Populate before sending response
    await contact.populate('createdBy.userId', 'name email avatar number');
    
    return res.json({ 
      success: true,
      message: "Contact updated successfully",
      contact 
    });

  } catch (err) {
    return res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// Delete contact (only removes current user from createdBy array)
exports.deleteContact = async (req, res) => {
  try {
    const { id } = req.params;
    
    const contact = await Contact.findById(id);
    if (!contact) {
      return res.status(404).json({ 
        success: false,
        message: "Contact not found" 
      });
    }

    // Find current user's entry
    const userIndex = contact.createdBy.findIndex(
      c => String(c.userId) === String(req.user._id)
    );
    
    if (userIndex === -1) {
      return res.status(403).json({ 
        success: false,
        message: "You cannot delete this contact" 
      });
    }

    // Remove current user from createdBy array
    contact.createdBy.splice(userIndex, 1);
    
    // If no one has this contact saved, delete the whole document
    if (contact.createdBy.length === 0) {
      await Contact.findByIdAndDelete(id);
      return res.json({ 
        success: true, 
        message: "Contact deleted successfully" 
      });
    }
    
    // Otherwise, save the updated contact
    await contact.save();
    
    return res.json({ 
      success: true, 
      message: "Contact removed from your list" 
    });
    
  } catch (err) {
    return res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// Block contact for current user
exports.blockContact = async (req, res) => {
  try {
    const { id } = req.params;
    
    const contact = await Contact.findById(id);
    if (!contact) {
      return res.status(404).json({ 
        success: false,
        message: "Contact not found" 
      });
    }

    // Find current user in createdBy array
    const entry = contact.createdBy.find(
      c => String(c.userId) === String(req.user._id)
    );
    
    if (!entry) {
      return res.status(403).json({ 
        success: false,
        message: "You cannot block this contact" 
      });
    }

    entry.isBlock = true;
    await contact.save();
    
    await contact.populate('createdBy.userId', 'name email avatar number');

    return res.json({ 
      success: true,
      message: "Contact blocked successfully",
      contact 
    });
    
  } catch (err) {
    return res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// Unblock contact for current user
exports.unblockContact = async (req, res) => {
  try {
    const { id } = req.params;
    
    const contact = await Contact.findById(id);
    if (!contact) {
      return res.status(404).json({ 
        success: false,
        message: "Contact not found" 
      });
    }

    const entry = contact.createdBy.find(
      c => String(c.userId) === String(req.user._id)
    );
    
    if (!entry) {
      return res.status(403).json({ 
        success: false,
        message: "You cannot unblock this contact" 
      });
    }

    entry.isBlock = false;
    await contact.save();
    
    await contact.populate('createdBy.userId', 'name email avatar number');

    return res.json({ 
      success: true,
      message: "Contact unblocked successfully",
      contact 
    });
    
  } catch (err) {
    return res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// Get a single contact
exports.getContact = async (req, res) => {
  try {
    const { id } = req.params;
    
    const contact = await Contact.findById(id)
      .populate('createdBy.userId', 'name email avatar number');
      
    if (!contact) {
      return res.status(404).json({ 
        success: false,
        message: "Contact not found" 
      });
    }

    // Check if current user has access to this contact
    const hasAccess = contact.createdBy.some(
      c => String(c.userId) === String(req.user._id)
    );
    
    if (!hasAccess) {
      return res.status(403).json({ 
        success: false,
        message: "You don't have access to this contact" 
      });
    }

    return res.json({ 
      success: true, 
      contact 
    });
    
  } catch (err) {
    return res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// Get all contacts created by current user
// Get all contacts created by current user
exports.getAllContacts = async (req, res) => {
  try {
    // Find contacts where current user is in createdBy array
    const contacts = await Contact.find({ 
      "createdBy.userId": req.user._id 
    })
    .populate({
      path: 'createdBy.userId',
      select: 'name email avatar number isOnline lastSeen'
    })
    .sort({ updatedAt: -1 })
    .lean();

    // Process each contact to include other user's data
    const formattedContacts = await Promise.all(contacts.map(async (contact) => {
      // Find the actual user associated with this contact number
      const otherUser = await User.findOne({ number: contact.number })
        .select('name email avatar number isOnline lastSeen')
        .lean();

      // Format createdBy array properly
      const createdByFormatted = contact.createdBy.map(entry => ({
        _id: entry._id,
        userId: entry.userId?._id || entry.userId,
        name: entry.name,
        isBlock: entry.isBlock || false,
        user: entry.userId // This is the current user's data
      }));

      return {
        _id: contact._id,
        number: contact.number,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
        createdBy: createdByFormatted,
        // Add the other user's data separately
        otherUser: otherUser || null,
        // For backward compatibility, also add targetUser
        targetUser: otherUser || null
      };
    }));

    return res.json({
      success: true,
      contacts: formattedContacts,
      count: formattedContacts.length
    });
    
  } catch (err) {
    console.error("Get all contacts error:", err);
    return res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};

// Search contacts (optional helper function)
exports.searchContacts = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.trim() === '') {
      return res.json({
        success: true,
        contacts: []
      });
    }

    // Search in contacts where current user has saved them
    const contacts = await Contact.find({
      "createdBy.userId": req.user._id,
      $or: [
        { number: { $regex: query, $options: 'i' } },
        { "createdBy.name": { $regex: query, $options: 'i' } }
      ]
    })
    .populate('createdBy.userId', 'name email avatar number')
    .limit(20);

    // Format the results
    const formattedContacts = contacts.map(contact => {
      const userEntry = contact.createdBy.find(
        entry => String(entry.userId._id) === String(req.user._id)
      );
      
      return {
        _id: contact._id,
        number: contact.number,
        savedName: userEntry?.name || "Unknown",
        registeredUser: contact.createdBy[0]?.userId || null
      };
    });

    return res.json({
      success: true,
      contacts: formattedContacts
    });
    
  } catch (err) {
    return res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};