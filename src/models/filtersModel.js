const mongoose = require('mongoose');

const columnMetaSchema = new mongoose.Schema({
  display: {
    type: String,
    required: true
  },
  value: {
    type: String,
    required: true,
    unique: true // optional, prevents duplicate 'value' fields
  }
}, {
  timestamps: true, // adds createdAt and updatedAt automatically
  strict: false
});

module.exports = mongoose.model('filters', columnMetaSchema);
