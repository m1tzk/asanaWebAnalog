const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    room: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    sender: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('ChatMessage', chatMessageSchema);