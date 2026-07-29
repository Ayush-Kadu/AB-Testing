const mongoose = require("mongoose");

const VariantSchema = new mongoose.Schema(
{
    experimentId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Experiment",
        required:true 
    },

    variantName:{
        type:String,
        required:true,
        enum:["A","B","C","D"]
    },

    // The variant's own campaign clone — created automatically when the
    // variant is created (see variantControllers.js#createVariant). This is
    // a full, independent copy of the experiment's parent campaign, so it
    // can be opened in the normal Campaign Builder (drag-and-drop templates,
    // onsite actions, triggers, etc.) and published on its own, same as any
    // other campaign. Once this is set, it — not the fields below — is the
    // source of truth for the variant's actual content.
    campaignId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"usercampaign",
        default:null
    },

    // Legacy/snapshot fields: the values the clone was created with. Kept so
    // older variants (created before campaignId existed) still render, and
    // as a fallback if the linked campaign is ever missing.
    popupContent:String,

    heading:String,

    imageURL:String,

    isActive: {
    type: Boolean,
    default: true
    },

    weight:{
        type:Number,
        default:50
    },

    impressions:{
        type:Number,
        default:0
    },

    clicks:{
        type:Number,
        default:0
    },

    conversions:{
        type:Number,
        default:0
    }

},
{
    timestamps:true
});

module.exports = mongoose.model("Variant",VariantSchema);