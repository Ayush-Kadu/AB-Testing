const ErrorHandler = require("../utils/errorHandler")


const validationError = (errors, next)=>{
    if(!errors.isEmpty()){
        const err = errors.errors || []
        if(err.length > 0){
            return next(new ErrorHandler(err[0]?.msg || "Validation filed."))
        } 
    }
}

module.exports = validationError