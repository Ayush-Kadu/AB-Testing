const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const campaignTypeModel = require('../models/campaignTypeModel');
const campaignActionModel = require('../models/campaignActionModel');
const campaignTriggerModel = require('../models/campaignTriggerModel');
const { createUserJSON } = require('../utils/helper');
exports.getScript = (req, res) => {
    const clientId = req.query.clientId;
    //const filePath = path.join(__dirname, `../scripts/scripts-${clientId}-${milliseconds}.js`);
    const filePath = path.join(__dirname, `../scripts/scripts-${clientId}.js`);
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading the file:', err);
            return res.status(500).send('Error fetching script');
        } else {
            res.setHeader('Content-Type', 'application/javascript');
            return res.status(200).send(data);
        }
    });
}


exports.addCampaignType = async (req, res, next) => {
    try {

        const data = [
            {
                name: "Inline Action"
            },
            {
                name: "Onsite Action"
            },
            {
                name: "Send Action"
            }
        ]

        await campaignTypeModel.insertMany(data)
        res.json({
            success: true,
            message: "Campaign Type added successfully."
        })

    } catch (error) {
        return next(error)
    }
}

exports.scriptWriteTest = async (req, res, next) => {
    try {
        await createUserJSON()
        // const data = "console.log('Script is written for update')"
        // const SCRIPTS_DIR = '/var/www/urlptscript/scripts';
        // if (!fs.existsSync(SCRIPTS_DIR)) {
        //     fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
        // }
        // const fileName = "testScript.js"
        // const filePath = path.join(SCRIPTS_DIR, fileName );
        // fs.writeFileSync(filePath, data);
        // res.json({
        //     success: true,
        //     message: "Test script generated"
        // })

    } catch (error) {
        return next(error)
    }
}

exports.addCampaignAction = async (req, res, next) => {
    try {
        const action = [
            "Light Box Popup",
            "Full Screen Welcome Mat",
            "Content Unlock",
            "Floating Bar",
            "Side Bar",
            "Inline Form",
            "Side In scroll Bar",
            "CowntDown Timer",
            "Spin and win Coupon wheel"
        ]

        const payload = action.map(el => {
            return {
                "actionName": el
            }
        })
        await campaignActionModel.insertMany(payload)
        res.json({
            success: true,
            message: "Campaign Type added successfully."
        })

        return
    } catch (error) {
        return next(error)
    }
}

exports.addCampaignTriggers = async (req, res, next) => {
    try {
        const triggers = [
            "Time On Page",
            "scroll",
            "Exit intent",
            "Time On Site",
            "Interactive Sensor",
            "Date And Time"
        ]


        const payload = triggers.map(el => {
            return {
                "triggerName": el
            }
        })
        await campaignTriggerModel
        await campaignTriggerModel.insertMany(payload)
        res.json({
            success: true,
            message: "Campaign triggers added successfully."
        })

        return
    } catch (error) {
        return next(error)
    }
}