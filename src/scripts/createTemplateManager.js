const mongoose = require('mongoose');
const User = require('../models/user.model');
require('dotenv').config();

const createTemplateManager = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/urlpt_backup');
        console.log('Connected to MongoDB');

        // Check if template manager already exists
        const existingTemplateManager = await User.findOne({ 
            email: 'template.manager@urlpt.com',
            role: 'template_manager'
        });

        if (existingTemplateManager) {
            console.log('Template manager already exists');
            return;
        }

        // Create template manager user
        const templateManager = new User({
            firstName: 'Template',
            lastName: 'Manager',
            email: 'template.manager@urlpt.com',
            password: 'TemplateManager@123', // This will be hashed by the pre-save hook
            role: 'template_manager',
            websites: [
                {
                    website: 'https://app.mimz.com',
                    isPrimary: true,
                    isActive: true
                }
            ],
            mobileNumber: '+1234567890',
            address1: 'Template Management Office',
            city: 'Template City',
            state: 'Template State',
            country: 'Template Country',
            pinCode: 12345
        });

        await templateManager.save();
        console.log('Template manager created successfully');
        console.log('Email: template.manager@urlpt.com');
        console.log('Password: TemplateManager@123');

    } catch (error) {
        console.error('Error creating template manager:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
};

// Run the script
createTemplateManager(); 