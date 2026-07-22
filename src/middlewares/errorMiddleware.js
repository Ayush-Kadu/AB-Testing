const errorMiddleware = (err, req, res, next)=>{
    err.message = err.message || "Internal server error."
    err.statusCode = err.statusCode || 500

    // Set CORS headers on error responses to prevent CORS errors
    const origin = req.headers.origin;
    if (origin) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    }

    res.status(err.statusCode).json({
        success: false,
        message: err.message
    })
}


module.exports = errorMiddleware