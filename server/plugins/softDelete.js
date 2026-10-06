const { Schema } = require('mongoose');

function softDelete(schema) {
    schema.add({
        isDeleted: { type: Boolean, default: false, index: true },
        deletedAt: { type: Date, default: null },
        deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
    });

    function hideTrashed() {
        if (this.getOptions().withDeleted) return;
        if (Object.prototype.hasOwnProperty.call(this.getFilter(), 'isDeleted')) return;
        this.where({ isDeleted: { $ne: true } });
    }

    ['find', 'findOne', 'findOneAndUpdate', 'countDocuments', 'updateMany'].forEach((op) => {
        schema.pre(op, hideTrashed);
    });

    schema.methods.moveToTrash = function (actorId) {
        this.isDeleted = true;
        this.deletedAt = new Date();
        this.deletedBy = actorId || null;
        return this.save();
    };

    schema.methods.restoreFromTrash = function () {
        this.isDeleted = false;
        this.deletedAt = null;
        this.deletedBy = null;
        return this.save();
    };
}

module.exports = softDelete;
