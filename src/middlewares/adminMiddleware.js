const ErrorHandler = require("../utils/errorHandler");

const isAdmin = (req, res, next)=>{
    try {
        // Set CORS headers before any error handling
        const origin = req.headers.origin;
        if (origin) {
            res.header('Access-Control-Allow-Origin', origin);
            res.header('Access-Control-Allow-Credentials', 'true');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
        }
        
        const user = req.user
        if(!user){
            return next(new ErrorHandler('Unauthorized', 401))
        }

        if(user.role !== 'admin'){
            return next(new ErrorHandler('You are not admin', 401))
        }
        next()
    } catch (error) {
        // Ensure CORS headers are set even on error
        const origin = req.headers.origin;
        if (origin) {
            res.header('Access-Control-Allow-Origin', origin);
            res.header('Access-Control-Allow-Credentials', 'true');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
        }
        return next(error)
    }
}

module.exports = isAdmin