const ErrorHandler = require('../utils/errorHandler')
const CredentialModel = require('./../models/credentialsModel')

exports.addCred = async (req, res, next) => {
    try {
        const payload = req.body
        const isExists = await Credential.findOne({'credName': payload.appName, isDelete: false})
        if(isExists){
            return next(new ErrorHandler('Something went wrong.'))
        }
        payload['createdBy'] = req.user._id
        const data = await CredentialModel.create(payload)
        if (!data) {
            return next(new ErrorHandler('Failed to create credentials', 500))
        }
        res.json({
            success: true,
            data
        })
    } catch (error) {
        return next(error)
    }
}


exports.updateCred = async (req, res, next) => {
    try {
        const payload = req.body;
        const credentialId = req.params.id

        if (!credentialId) {
            return next(new ErrorHandler('Credential ID is required', 400));
        }

        payload.updatedBy = req.user._id;

        const updatedCred = await CredentialModel.findByIdAndUpdate(
            credentialId,
            payload,
            { new: true, runValidators: true }
        );

        if (!updatedCred) {
            return next(new ErrorHandler('Credential not found or failed to update', 404));
        }

        res.json({
            success: true,
            data: updatedCred
        });
    } catch (error) {
        return next(error);
    }
};

exports.getCred = async (req, res, next) => {
    try {
        const filter = {isDelete: false}
        if (req.query.credName) {
            filter['credName'] = req.query.credName
        }
        const credentials = await CredentialModel.findOne(filter);

        if (!credentials) {
            return next(new ErrorHandler('Credential not found or failed to update', 404));
        }

        res.json({
            success: true,
            data: credentials
        });
    } catch (error) {
        return next(error);
    }
};
