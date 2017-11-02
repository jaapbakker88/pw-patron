// server.js
// where your node app starts
require('dotenv').config()

// init project
var express = require('express');
var Mollie = require("mollie-api-node");
var mongoose = require('mongoose');
var Order = require('./models/order');
var nodemailer = require('nodemailer');
var transporter = nodemailer.createTransport('smtps://'+process.env.SMTP_LOGIN+':'+process.env.SMTP_PASSW+'@smtp.mailgun.org');
var bodyParser = require('body-parser');
var session = require('express-session');
var cookieParser = require('cookie-parser');


mongoose.Promise = global.Promise;
mongoose.connect(process.env.DB, {useMongoClient: true})

var app = express();

// we've started you off with Express, 
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

var mollie = new Mollie.API.Client;
mollie.setApiKey(process.env.MOLLIE_API_KEY);

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));
app.set('view engine', 'pug');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use(session({secret: 'super secret',saveUninitialized: false, resave: true}));

app.get('/', function(req, res) {
  res.render('index');
});

// http://expressjs.com/en/starter/basic-routing.html
app.all("/checkout", function (req, res) {
  var amount;
  var name;
  var type;
  if (req.body.item === 'super'){
    name = 'Super Patron';
    type = 'super';
    amount = 50.00;
  } else {
    name = 'Party Patron';
    type = 'party';
    amount = 25.00
  }
  res.render('checkout', {name: name, amount: amount, type:type});
});

app.all('/patron', function(req, res){
  var amount;
  var name;
  var type;
  if (req.body.item === 'super'){
    name = 'Super Patron';
    type = 'super';
    amount = 50.00;
  } else {
    name = 'Party Patron';
    type = 'party';
    amount = 25.00
  }
  
  mollie.payments.create({
    amount:      amount,
    description: `${name}: ${req.body.firstName} ${req.body.lastName} ${req.body.email}`,
    redirectUrl: process.env.BASEURL + "/thanks",
    webhookUrl:  process.env.BASEURL + "/webhook"
    }, function (payment) {
        res.writeHead(302, { Location: payment.getPaymentUrl() })
        var newOrder = {
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          email: req.body.email,
          comment: req.body.comment,
          orderId: payment.id,
          orderType: type,
          amount: amount,
          order: payment
        }
        Order.create(newOrder, function(err, order){
          if(err) {
            console.log(err)
          } else {
            res.end();
          }
        });    
        res.end();
    });
   
});

app.all('/webhook', function(req, res){
  var paymentId = req.body.id;  
  mollie.payments.get(paymentId, function(payment) {
    if (payment.error || payment.status === "expired") {   
      res.send('Something went wrong!');
      // res.render('payment-error', { 'error': payment.error });
    }else {
      Order.findOneAndUpdate({orderId: payment.id}, {$set:{order: {status: payment.status}}}, {new: true}, function(err, order) {
        if(err) {
          console.log(err);
        } else {
          console.log("Payment Status: " + payment.status);
          order["order"]["status"] = payment.status;
          console.log("Order Status: " + order.order.status);
          // order.save();
          // CONFIRMATION EMAIL
          var mailOptions = {
            from: '"'+ "Dan @ PartyWith" +'" <'+process.env.TEST_SENDER+'>', // sender address
            to: order.email, // list of receivers
            subject: 'You’re now a 💎 Party Patron 💎', // Subject line
            text: req.body.text, // plaintext body
              html: `
                <div id="header">Thank you for becoming a Party Patron. And welcome to the PartyWith family!</div>
                <div id="body">
                  <p>Your perks:
                    <ul>
                      <li><strong>1 year subscription of Globetrotter:</strong> Within 2 working days your Globetrotter subscription will be activated. Now you can chat with anyone and join any event on the app, no matter where they are.</li>
                      <li><strong>1 featured event per month:</strong> Just email us at info@partywith.co with the title of the event you wish to feature (it can be any event on the app).</li>
                      <li><strong>A shiny badge:</strong> Your badge will be proudly displayed on your profile starting X Nov 2017.</li>
                    </ul>
                  </p>
                  <p>Should you have any questions about your perks or feedback about the app, you have a direct line to me - contact me any time.</p>
                  <p>Cheers,<br>
                  Dan</p>
                </div>
                <div id="footer"><p><small>This is an automatically generated email</small></p></div>
              ` // html body
                // <p><b><a href="${process.env.BASEURL}/order/${order.orderId}">${process.env.BASEURL}/order/${order.orderId}</a></b></p>
          };
          // send mail with defined transport object
          transporter.sendMail(mailOptions, function(error, info){
              if(error){
                  return console.log(error);
              }
              console.log('Message sent: ' + info.response);
          });
          
          // ADMIN EMAIL
          var mailOptions2 = {
            from: '"'+ "Dan @ PartyWith" +'" <'+process.env.TEST_SENDER+'>', // sender address
            to: process.env.TEST_RECIPIENT, // list of receivers
            subject: 'New 💎 Patron 💎 Order', // Subject line
            text: req.body.text, // plaintext body
              html: `
                <div id="header"><strong>There's a new 💎 Patron 💎 order that requires action</strong></div>
                <div id="body">
                  <p>
                    <strong>name:</strong> ${order.firstName} ${order.lastName} <br>
                    <strong>email:</strong> ${order.email} <br>
                    <strong>comment:</strong> ${order.comment}
                  </p>
                  <p><b><a href="${process.env.BASEURL}/order/${order.orderId}">${process.env.BASEURL}/order/${order.orderId}</a></b></p>  
                </div>
                <div id="footer"><p><small>This is an automatically generated email</small></p></div>
              ` // html body
          };
          transporter.sendMail(mailOptions2, function(error, info){
              if(error){
                  return console.log(error);
              }
              console.log('Message sent: ' + info.response);
          });
          
        }
      })
      res.status(200).send('Success!!');
      // res.render('executed-payment', { 'payment': payment });
    }
  });
});

app.get('/order/:orderid', function(req, res) {
  mollie.payments.get(req.params.orderid, function(payment) {
    // console.log(payment)
    res.render('order', {order: payment}); 
  });
});

app.all('/thanks', function(req, res){
  var paymentId = req.body.id; 
  res.render('thanks');
});

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
