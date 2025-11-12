const mongoose = require('mongoose');
const { ORDER_STATUS } = require('../utils/constants');

const orderSchema = new mongoose.Schema(
  {
    service_type: { type: String, required: true, trim: true },
    price: { type: Number, required: true, default: 0 },
    client_name: { type: String, required: true, trim: true },
    client_phone1: { type: String, required: true, trim: true },
    client_phone2: { type: String, trim: true },
    address_text: { type: String, trim: true },
    address_coords: {
      lat: { type: Number },
      lng: { type: Number }
    },
    image_url: { type: String },
    verification_code: { type: String, required: true },
    created_by_admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    assigned_to_driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DriverProfile'
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client'
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
      index: true
    },
    timestamp_started: { type: Date },
    timestamp_completed: { type: Date },
    valor_motorista: { type: Number, default: 0 },
    valor_empresa: { type: Number, default: 0 }
  },
  { timestamps: true }
);

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ assigned_to_driver: 1, status: 1 });
orderSchema.index({ client: 1, status: 1, timestamp_completed: -1 });

module.exports = mongoose.model('Order', orderSchema);