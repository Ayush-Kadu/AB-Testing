const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

require('dotenv').config();

const adminRoles = new mongoose.Schema(
    {
        roleId:{  type: mongoose.Schema.Types.ObjectId,ref: 'Adminaccount',required: true},   
        role:{type:String,required:true},
        permission:{type:String,required:true}
    
    },
  {
    timestamps: true,
    versionKey: false,
  }
);

//password bcryption
adminRoles.pre("save", async function (next) {
  const hash =await bcrypt.hashSync(this.password, 10);
  this.password = hash;
  next();
});

//password comparision
adminRoles.methods.comparePassword = async function (password) {
  return await bcrypt.compareSync(password, this.password);
};

const Adminrole = new mongoose.model("adminrole", adminRoles);
module.exports = Adminrole;
