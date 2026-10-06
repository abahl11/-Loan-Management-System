const { Schema, model } = require('mongoose');
const { ROLES } = require('../core/constants');

const roleSchema = new Schema(
    {
        name: { type: String, enum: Object.values(ROLES), required: true, unique: true },
        title: { type: String, required: true },
        description: { type: String, default: '' }
    },
    { timestamps: true }
);

module.exports = model('Role', roleSchema);
