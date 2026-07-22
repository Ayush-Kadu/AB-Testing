const mongoose = require("mongoose");


const userVsitor = new mongoose.Schema(
  {
 Id:{type:String,required:false},
    userIp:{type:String,required:false},
    gaClientId:{type:String,required:false},
    originalRef:{type:String,required:false},
    organicSource:{type:String,required:false},
    organicSourceStr:{type:String,required:false},
    ref:{type:String,required:false},
    landingPage:{type:String,required:false},
    domain:{type:String,required:false},
    urlBase:{type:String,required:false},
    trafficSource:{type:String,required:false},
    firstTrafficSource:{type:String,required:false},
    cityName:{type:String,required:false},
    countryName:{type:String,required:false},
    longitude:{type:String,required:false},
    latitude: { type: String, required: false },
    interactions: { type: Array, required: false },
    url: { type: String, required: false },
    region_name:{ type: String, required: false },
    deviceInfo: { type: Object, required: false },
    userAgent:{ type: String, required: false },
    

},
  {
    timestamps: true,
    versionKey: false,
    strict: false, 
  }
);


const Uservisitor = new mongoose.model("uservisitor", userVsitor);
module.exports = Uservisitor;
