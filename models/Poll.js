const mongoose = require('mongoose');

const pollOptionSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true, maxlength: 200 },
  votes: { type: Number, default: 0 },
  voters: [{ type: String }]
});

const pollSchema = new mongoose.Schema(
  {
    room: { type: String, required: true, trim: true, index: true },
    question: { type: String, required: true, trim: true, maxlength: 300 },
    createdBy: { type: String, required: true, trim: true },
    options: [pollOptionSchema]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Poll', pollSchema);