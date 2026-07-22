const ErrorHandler = require("../utils/errorHandler");

const isTemplateManager = (req, res, next) => {
    try {
        const user = req.user;
        if (!user) {
            return next(new ErrorHandler('Unauthorized', 401));
        }

        if (user.role !== 'template_manager' && user.role !== 'admin') {
            return next(new ErrorHandler('Access denied. Template manager privileges required.', 403));
        }
        next();
    } catch (error) {
        return next(error);
    }
};

module.exports = isTemplateManager; 