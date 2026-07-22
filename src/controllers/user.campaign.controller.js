const scriptModel = require("../models/scriptModel");
const Usercampaign = require("../models/user.campaign.model");
const { createPopScript, createCampaignScript, campaignStatusUpdate, updateCampaignScript } = require("../utils/createScript");
const deleteScript = require("../utils/delete.scriptfile");
const ErrorHandler = require("../utils/errorHandler");
const updateScript = require("../utils/updateScript");
const mongoose = require('mongoose');

exports.createCampaign = async (req, res) => {
    try {
        const { campaignData, popupContent } = req.body;
        const campaign = await Usercampaign.create(campaignData);
        const isActive = req?.body?.campaignData?.isActive
        const user = req.user
        if (!campaign) {
            return res.status(203).send({ message: "Unable to create campaign data" });
        } else {
            await createCampaignScript(popupContent,user._id, campaign._id, isActive )
            return res.status(201).send({ message: "Campaign created successfully", campaign });
        }
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
}

exports.getCampaign = async (req, res) => {
    try {
        const campaign = await Usercampaign.findById({ _id: req.params.id });
        if (!campaign) {
            return res.status(203).send({ message: `Campaign ${req.params.id} is not present` });
        }
        return res.status(200).send({ message: "Campaign fetched successfully", campaign });
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
}

exports.getAllCampaign = async (req, res) => {
    try {
        const clientId = new mongoose.Types.ObjectId(req.query.clientId);
        const campaigns = await Usercampaign.find({clientId:clientId});
        if (!campaigns) {
            return res.status(203).send({ message: "Unable to fetch campaign data" });
        }
        return res.status(200).send({ message: "Campaign fetched successfully", campaigns });
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
}

exports.deleteCampaign = async (req, res) => {
    try {
        const campaignPresent = await Usercampaign.findById({ _id: req.params.id });
        if (!campaignPresent) {
            return res.status(203).send({ message: `Campaign ${req.params.id} is not present` });
        }
        const campaign = await Usercampaign.findByIdAndDelete({ _id: req.params.id })
        const result = await Usercampaign.find({});

       
        let output = deleteScript(campaign.createdAt,  campaign.clientId);
      
        return res.status(200).send({ message: "Campaign DELETED successfully", campaign });
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
}
exports.changeCampaignStatus = async (req, res, next) => {
    try {
        const campaignId = req.params.id
        const status = req.body.status
        const user = req.user
        const fileName = `${user._id}-${campaignId}.js`

        if(!campaignId){
            return next(new ErrorHandler("Campaign ID not found!."))
        }
        await Usercampaign.findOneAndUpdate({"_id": campaignId}, {isActive: status})

        if(fileName){
            await scriptModel.findOneAndUpdate({"name": fileName}, {isActive: status})
        }

     

        // await campaignStatusUpdate(user._id, campaignId, status)
        res.json({
            success: true, 
            message: "Campaign Updated successfully."
        })
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
}
exports.updateCampaign = async (req, res) => {
    try {
        const { campaignData, popupContent } = req.body;
        const campaignPresent = await Usercampaign.findById({ _id: req.params.id });
        const user = req.user
        if (!campaignPresent) {
            return res.status(203).send({ message: `Campaign ${req.params.id} is not present` });
        }
        else {
            const campaign = await Usercampaign.findByIdAndUpdate(req.params.id, campaignData, { new: true });
            await updateCampaignScript(popupContent,user._id, campaignPresent._id )
            return res.status(200).send({ message: "Campaign updated successfully", campaign });
        }
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
}
