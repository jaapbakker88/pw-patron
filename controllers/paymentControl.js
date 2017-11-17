var Payment = require('../models/payment');

var mongoose  = require('mongoose');
mongoose.Promise = global.Promise;

var paymentControl = {
  createPayment: function(paymentId, newPaymentObj){
    Payment.create({orderId: paymentId, order: newPaymentObj}, function(err, savedPayment){
      if(err) {
        console.log(err)
      } else {
        console.log('payment saved!')
      }
    });
  },
  updatePayment: function(paymentId, newPaymentObj){
    Payment.findOneAndUpdate({orderId: paymentId}, {$set:{order: newPaymentObj }}, {new: true}, function(err, savedPayment) {
      if(err) {
        console.log(err);
      } else {
        console.log('payment updated!')
      }
    });
  }
}

module.exports = paymentControl;