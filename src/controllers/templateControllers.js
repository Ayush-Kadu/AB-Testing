const Templates = require("../models/templateModel")
const ErrorHandler = require("../utils/errorHandler")
const { uploadFileToS3 } = require("../utils/uploadHelper")

exports.addTemplate = async (req, res, next) => {
    try {
        const payload = req.body  
        console.log('=== TEMPLATE CREATION START ===');
        console.log('addTemplate called with payload:', payload);
        console.log('User role:', req.user.role);
        console.log('User ID:', req.user._id);
        
        // Handle industry and goal arrays
        if (payload?.industry && typeof payload.industry === 'string') {
            payload['industry'] = payload.industry.split(',');
        }
        if (payload?.goal && typeof payload.goal === 'string') {
            payload['goal'] = payload.goal.split(',');
        }
        
        const user = req.user
        
        const file = req?.files?.templateImage;
        const teaserImage = req?.files?.teaserImage
        
        console.log('Files received:', { templateImage: !!file, teaserImage: !!teaserImage });
        
        if(teaserImage){
            const s3URL = await uploadFileToS3(teaserImage, 'template-preview');
            payload['teaserImage'] = s3URL;
            console.log('Teaser image uploaded:', s3URL);
        }

        if(file){
            const s3URL = await uploadFileToS3(file, 'template-preview');
            payload['previewImage'] = s3URL;
            console.log('Preview image uploaded:', s3URL);
        }
        
        // Handle elements from template builder
        if (payload.elements && typeof payload.elements === 'string') {
            try {
                payload.elements = JSON.parse(payload.elements);
                console.log('Elements parsed successfully:', payload.elements.length, 'elements');
            } catch (parseError) {
                console.error('Error parsing elements JSON:', parseError);
                return next(new ErrorHandler('Invalid elements format'));
            }
        }
        
        var template 
        if(payload?.templateId){
            console.log('Updating existing template:', payload.templateId);
            payload['updatedBy'] = user._id
            template = await Templates.findByIdAndUpdate(payload?.templateId, payload, {new: true})
        }else{
            console.log('Creating new template');
            payload['createdBy'] = user._id
            payload.slug = payload.templateName.toLowerCase().replace(/\s+/g, '_');
            // Set default status based on user role
            if (!payload.status) {
                payload.status = user.role === 'admin' ? 'published' : 'draft';
            }
            console.log('Creating template with status:', payload.status);
            console.log('Final payload:', payload);
            template = await Templates.create(payload)
        }
        console.log('Template created/updated successfully:', template);
        console.log('=== TEMPLATE CREATION END ===');
        
        if (!template) return next(new ErrorHandler('Failed to create template.'))
        res.json({
            success: true,
            data: template
        })

    } catch (error) {
        console.error('=== TEMPLATE CREATION ERROR ===');
        console.error('Error in addTemplate:', error);
        return next(error)
    }
}

exports.updateTemplateById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const payload = req.body;
        const user = req.user;

        payload['updatedBy'] = user._id; // Optional: track who updated it

        const updatedTemplate = await Templates.findByIdAndUpdate(id, payload, {
            new: true, // return the updated document
        });

        if (!updatedTemplate) return next(new ErrorHandler('Template not found.', 404));

        res.json({
            success: true,
            data: updatedTemplate
        });
    } catch (error) {
        return next(error);
    }
};

exports.updateTemplateDetails = async (req, res, next) => {
    try {

        const payload = req.body;
        console.log('payload: ', payload);
        const file = req?.files?.templateImage;
        if(!payload.previewImage && !file){
            return next(new ErrorHandler('Image not found!.'))
        }

        if(file){
            const s3URL = await uploadFileToS3(file, 'template-preview');
            payload['previewImage'] = s3URL;
        }

        await Templates.findByIdAndUpdate(req.params.id, payload);

        res.json({
            success: true,
            message: "Template saved successfully."
        });
    } catch (error) {
        next(error);
    }
};



exports.getTemplates = async (req, res, next) => {
    try {
        const user = req.user;
        console.log('getTemplates called by user:', user.role, user.email);
        
        const { category, subCategory, name, industry, goal } = req.query
        const filter = {
            isDeleted: false // apply to all users
        };

        // Show all templates to admin and template_manager, only published to regular users
        if (user.role !== 'admin' && user.role !== 'template_manager') {
            filter.status = "published"; // only for regular users
        }
        // For admin and template_manager, don't filter by status - show all templates

        console.log('Initial filter:', filter);

        if(category){
            filter.category = category
        }

        // AND logic for industry and goal
        const andFilters = [];
        if (industry) {
            const industries = typeof industry === 'string' ? industry.split(',') : [];
            andFilters.push({
                $or: [
                    { industry: { $in: industries } }, // array contains any
                    { industry: { $in: industries.map(val => [val]) } }, // array equals single value
                    { industry: { $in: industries } }, // string equals any
                ]
            });
        }
        if (goal) {
            const goals = typeof goal === 'string' ? goal.split(',') : [];
            andFilters.push({
                $or: [
                    { goal: { $in: goals } }, // array contains any
                    { goal: { $in: goals.map(val => [val]) } }, // array equals single value
                    { goal: { $in: goals } }, // string equals any
                ]
            });
        }
        if (andFilters.length > 0) {
            filter.$and = andFilters;
        }
        

        if(subCategory){
            filter.subCategory = subCategory
        }
        if (name) {
            filter.templateName = { $regex: name, $options: 'i' }; // Case-insensitive search
        }

        console.log('Final filter:', JSON.stringify(filter, null, 2));

        const templates = await Templates.find(filter).sort({ createdAt: -1 }); // Sort by createdAt in descending order (newest first)

        console.log('Found templates:', templates.length);
        console.log('Template statuses:', templates.map(t => ({ name: t.templateName, status: t.status })));

        res.json({
            success: true,
            data: templates || []
        });
    } catch (error) {
        console.error('Error in getTemplates:', error);
        return next(error);
    }
}


exports.getTemplate = async (req, res, next) => {
    try {
        const { id } = req.params
        if (!id) return next(new ErrorHandler('Template id not found'))
        const filter = {
            isDeleted: false,
            _id: id
        };

        const templates = await Templates.findOne(filter);
        if (!templates) {
            return next(new ErrorHandler('Template not found!'))
        }

        res.json({
            success: true,
            data: templates
        });
    } catch (error) {
        return next(error);
    }
}

exports.deleteTemplate = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;

        if (!id) {
            return next(new ErrorHandler('Template id not found'));
        }

        // Check if template exists and is not already deleted
        const template = await Templates.findOne({ _id: id, isDeleted: false });
        if (!template) {
            return next(new ErrorHandler('Template not found or already deleted'));
        }

        // Soft delete by setting isDeleted to true
        const deletedTemplate = await Templates.findByIdAndUpdate(
            id, 
            { 
                isDeleted: true,
                updatedBy: user._id 
            }, 
            { new: true }
        );

        res.json({
            success: true,
            message: 'Template deleted successfully',
            data: deletedTemplate
        });
    } catch (error) {
        return next(error);
    }
}

exports.getDraftTemplates = async (req, res, next) => {
    try {
        const user = req.user;
        console.log('getDraftTemplates called by user:', user.role, user.email);
        
        // Only admin can access draft templates
        if (user.role !== 'admin') {
            console.log('Access denied for user role:', user.role);
            return next(new ErrorHandler('Access denied. Only admins can view draft templates.', 403));
        }

        const { category, subCategory, name } = req.query;
        console.log('Filter parameters:', { category, subCategory, name });

        const filter = {
            isDeleted: false,
            status: "draft"
        };

        // Add category filter
        if (category) {
            filter.category = category;
        }

        // Add subcategory filter
        if (subCategory) {
            filter.subCategory = subCategory;
        }

        // Add name search filter
        if (name) {
            filter.templateName = { $regex: name, $options: 'i' }; // Case-insensitive search
        }

        console.log('Final filter:', JSON.stringify(filter, null, 2));

        const templates = await Templates.find(filter)
            .populate('createdBy', 'firstName lastName email')
            .sort({ createdAt: -1 });

        console.log('Found templates:', templates.length);

        res.json({
            success: true,
            data: templates || []
        });
    } catch (error) {
        console.error('Error in getDraftTemplates:', error);
        return next(error);
    }
}          

exports.approveTemplate = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;

        // Only admin can approve templates
        if (user.role !== 'admin') {
            return next(new ErrorHandler('Access denied. Only admins can approve templates.', 403));
        }

        if (!id) {
            return next(new ErrorHandler('Template id not found'));
        }

        // Check if template exists and is in draft status
        const template = await Templates.findOne({ _id: id, isDeleted: false, status: 'draft' });
        if (!template) {
            return next(new ErrorHandler('Template not found or not in draft status'));
        }

        // Approve template by changing status to published
        const approvedTemplate = await Templates.findByIdAndUpdate(
            id, 
            { 
                status: 'published',
                updatedBy: user._id 
            }, 
            { new: true }
        );

        res.json({
            success: true,
            message: 'Template approved successfully',
            data: approvedTemplate
        });
    } catch (error) {
        return next(error);
    }
}

exports.debugTemplates = async (req, res, next) => {
    try {
        const user = req.user;
        
        // Only admin can access debug endpoint
        if (user.role !== 'admin') {
            return next(new ErrorHandler('Access denied. Only admins can access debug endpoint.', 403));
        }

        // Get all templates (including deleted ones for debugging)
        const allTemplates = await Templates.find({}).sort({ createdAt: -1 });
        
        // Get draft templates specifically
        const draftTemplates = await Templates.find({ 
            isDeleted: false, 
            status: "draft" 
        }).populate('createdBy', 'firstName lastName email');

        // Get published templates
        const publishedTemplates = await Templates.find({ 
            isDeleted: false, 
            status: "published" 
        });

        res.json({
            success: true,
            data: {
                allTemplates: allTemplates.map(t => ({
                    _id: t._id,
                    templateName: t.templateName,
                    status: t.status,
                    isDeleted: t.isDeleted,
                    createdBy: t.createdBy,
                    createdAt: t.createdAt
                })),
                draftTemplates: draftTemplates.length,
                publishedTemplates: publishedTemplates.length,
                totalTemplates: allTemplates.length
            }
        });
    } catch (error) {
        console.error('Error in debugTemplates:', error);
        return next(error);
    }
}


// /?utm_source=google&utm_medium=cpc&utm_campaign=test-campaign&utm_term=test-digital%20agency%20in%20delhi&utm_device=m&utm_matchtype=p&utm_adgroup=test-DMagencycompanyfirmdelhi&utm_adcopyid=407678413195&utm_adposition=4&utm_devicemodel=mobile&utm_physical_location=9298247&utm_interest_location=20456&gclid=74185296363&utm_content=test-content&utm_placement=testkrlo.com