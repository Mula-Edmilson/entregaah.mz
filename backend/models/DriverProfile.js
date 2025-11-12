const mongoose = require('mongoose');
const { DRIVER_STATUS, FINANCIAL } = require('../utils/constants');

const driverProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    vehicle_plate: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: Object.values(DRIVER_STATUS),
      default: DRIVER_STATUS.OFFLINE,
      index: true
    },
    commissionRate: {
      type: Number,
      min: 0,
      max: 100,
      default: FINANCIAL.DEFAULT_COMMISSION_RATE
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('DriverProfile', driverProfileSchema);