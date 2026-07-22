const mongoose = require("mongoose");

const AssignmentSchema = new mongoose.Schema(
{

    experimentId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Experiment"
    },

    visitorId:String,

    variantId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Variant"
    }

},
{
    timestamps:true
});

module.exports = mongoose.model("Assignment",AssignmentSchema);