const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

require('dotenv').config();

const adminAccount = new mongoose.Schema(
  {
    userId:{  type: mongoose.Schema.Types.ObjectId, ref: 'User',required: true},   

},
  {
    timestamps: true,
    versionKey: false,
  }
);

//password bcryption
adminAccount.pre("save", async function (next) {
  const hash =await bcrypt.hashSync(this.password, 10);
  this.password = hash;
  next();
});

//password comparision
adminAccount.methods.comparePassword = async function (password) {
  return await bcrypt.compareSync(password, this.password);
};

const Adminaccount = new mongoose.model("adminaccount", adminAccount);
module.exports = Adminaccount;
