const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');
const softDelete = require('../plugins/softDelete');

const userSchema = new Schema(
    {
        fullName: { type: String, required: true, trim: true, maxlength: 80 },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        phone: { type: String, trim: true, default: '' },
        passwordHash: { type: String, required: true, select: false },
        role: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
        isActive: { type: Boolean, default: true },
        lastLoginAt: { type: Date, default: null }
    },
    { timestamps: true }
);

userSchema.plugin(softDelete);

userSchema.methods.setPassword = async function (plainText) {
    this.passwordHash = await bcrypt.hash(plainText, 10);
};

userSchema.methods.passwordMatches = function (plainText) {
    return bcrypt.compare(plainText, this.passwordHash || '');
};

userSchema.set('toJSON', {
    transform(doc, out) {
        delete out.passwordHash;
        delete out.__v;
        return out;
    }
});

module.exports = model('User', userSchema);
