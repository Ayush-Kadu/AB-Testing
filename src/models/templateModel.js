const mongoose = require('mongoose')

const ElementSchema = new mongoose.Schema({
    id: String,
    type: String,
    content: String,
    placeholder: String,
    style: mongoose.Schema.Types.Mixed
  }, {strict: false});

const TemplateSchema = new mongoose.Schema({
    templateName: {
        type: String,
    },
    elements: [ElementSchema],
    category : {
        type: String,
    },
    subCategory : {
        type: String,
    },
    description: {
        type: String,
    },
    previewImage : {
        type: String,
    },
    teaserImage : {
        type: String,
    },
    mainColor: {
        type: String,
        default: '#6B21A8'
    },
    mainFont: {
        type: String,
        default: 'Arial'
    },
    secondaryFont: {
        type: String,
        default: 'Sans-serif'
    },
    status: {
        type: String,
        enum: ['draft', 'published'],
        default: 'draft'
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    updateBy: {
        type: mongoose.Schema.Types.ObjectId,
    },
    publishedBy: {
        type: mongoose.Schema.Types.ObjectId,
    },
    slug:{
        type: String,
        required: true
    },
    industry: [{ type: String }],
    goal: [{ type: String }],
},{ timestamps: true, versionKey: false, strict: false })


module.exports = mongoose.model("Templates", TemplateSchema);
