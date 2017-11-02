var mongoose  = require('mongoose');
mongoose.Promise = global.Promise;

var orderSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  orderId: String,
  type: String,
  amount: Number,
  comment: String,
  order: Object
},
{
  timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);