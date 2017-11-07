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
app.use(session({
   cookieName: 'sessionName',
   secret: "notagoodsecretnoreallydontusethisone",
   resave: false,
   saveUninitialized: true,
   httpOnly: true,  // dont let browser javascript access cookie ever
   secure: true, // only use cookie over https
   ephemeral: true // delete this cookie while browser close
}));

app.get('/', function(req, res) {
  res.render('champion');
});

app.get('/champion', function(req, res) {
  res.render('champion')
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
  } else if(req.body.item === 'champion') {
      name = 'Party Champion: (1 year)';
      type = 'champion';
      amount = 20.00;    
  } else if(req.body.item === 'championl') {
      name = 'Party Champion (lifetime!)';
      type = 'champion';
      amount = 50.00;    
  } else {
    name = 'Party Patron';
    type = 'party';
    amount = 25.00
  }
  res.render('checkout', {name: name, amount: amount, type:type});
});

app.all('/patron', function(req, res){
  
  var sess = req.session;
  var amount;
  var name;
  var type;
  if(req.body.item === 'champion') {
      name = 'Party Champion: (1 year)';
      type = 'champion';
      amount = 20.00;    
  } else if(req.body.item === 'championl') {
      name = 'Party Champion (lifetime!)';
      type = 'champion';
      amount = 50.00;    
  }

  mollie.payments.create({
    amount:      amount,
    description: `${name}`,
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
          orderName: name,
          amount: amount,
          order: payment
        }
        sess.paymentId = payment.id;   
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
    if (payment.error || payment.status === "expired" || payment.status === "cancelled") {   
      res.send('Something went wrong!');
      Order.findOneAndUpdate({orderId: payment.id}, {$set:{order: payment }}, {new: true}, function(err, order) {
        if(err) {
          console.log(err);
          payment.redirectUrl = process.env.BASEURL;
          res.send(payment.error);
        } else {
          payment.redirectUrl = process.env.BASEURL;
          res.send(payment.error);
        }
      });
      // res.render('payment-error', { 'error': payment.error });
    }else {
      Order.findOneAndUpdate({orderId: payment.id}, {$set:{order: payment }}, {new: true}, function(err, order) {
        if(err) {
          console.log(err);
        } else {
          // CONFIRMATION EMAIL
          var mailOptions = {
            from: '"'+ "Dan @ PartyWith" +'" <'+process.env.TEST_SENDER+'>', // sender address
            to: order.email, // list of receivers
            subject: 'You’re now a Champion 🏆', // Subject line
            text: req.body.text, // plaintext body
              html: `
                <div id="header">
                  <p>Dear ${order.firstName},</p>
                  <p>Thank you for becoming a ${order.orderName}, a verified member of the PartyWith app. Your support means so much to us. And welcome to the PartyWith family!!</p>
                </div>
                <div id="body">
                  <p>Your perks:
                    <ul>
                      <li><strong>A shiny badge:</strong> Your badge will be proudly displayed on your profile starting 28 Nov 2017, for one year.</li>
                      <li><strong>A direct line of communication</strong> with the PartyWith team: Feel free to reach out to me anytime about the app, and I’ll keep you in the loop on the app’s latest updates as well.</li>
                      <li><strong>Party points</strong>: Will be launched once we reach 100 champions on the app. Stay tuned.</li>
                    </ul>
                  </p>
                  <p>Cheers,<br>
                  Dan</p>
                </div>
                <div id="footer"><p><small>This is an automatically generated email</small></p></div>
              ` // html body
                // <p><b><a href="${process.env.BASEURL}/order/${order.orderId}">${process.env.BASEURL}/order/${order.orderId}</a></b></p>
          };
          // var mailOptionsSuper = {
          //   from: '"'+ "Dan @ PartyWith" +'" <'+process.env.TEST_SENDER+'>', // sender address
          //   to: order.email, // list of receivers
          //   subject: 'You’re now a Party Champion', // Subject line
          //   text: req.body.text, // plaintext body
          //     html: `
          //       <div id="header">
          //         <p>Dear ${order.firstName},</p>
          //         <p>Thank you for becoming a Super Patron. Your support means so much to us. And welcome to the PartyWith family!</p>
          //       </div>
          //       <div id="body">
          //         <p>Your perks:
          //           <ul>
          //             <li><strong>1 year subscription of Globetrotter:</strong> This is currently a free feature that becomes paid on iOS starting 17 Nov 2017. You can continue to chat with anyone and join any event on the app, no matter where they are.</li>
          //             <li><strong>1 featured event per month:</strong> Just email us at info@partywith.co with the title of the event you wish to feature (it can be any event on the app).</li>
          //             <li><strong>A shiny badge:</strong> Your badge will be proudly displayed on your profile starting 17 Nov 2017.</li>
          //           </ul>
          //         </p>
          //         <p>Should you have any questions about your perks or feedback about the app, you have a direct line to me - please reach out any time.</p>
          //         <p>Cheers,<br>
          //         Dan</p>
          //       </div>
          //       <div id="footer"><p><small>This is an automatically generated email</small></p></div>
          //     ` 
          // };
          // if(order.orderType === 'championl') {
          //   var mailOptions = mailOptionsSuper;
          // } else {
          //   var mailOptions = mailOptionsParty;
          // }
          // send mail with defined transport object
          transporter.sendMail(mailOptions, function(error, info){
              if(error){
                  return console.log(error);
              }
              console.log('Message sent: ' + info.response);
          });
          
          // ADMIN EMAIL
          var mailOptionsAdmin = {
            from: '"'+ "Dan @ PartyWith" +'" <'+process.env.TEST_SENDER+'>', // sender address
            to: process.env.TEST_RECIPIENT, // list of receivers
            subject: 'New 🏆 Champion 🏆 Order', // Subject line
            text: req.body.text, // plaintext body
              html: `
                <div id="header"><strong>There's a new 🏆 Champion 🏆 order that requires action</strong></div>
                <div id="body">
                  <p>
                    <strong>name:</strong> ${order.firstName} ${order.lastName} <br>
                    <strong>email:</strong> ${order.email} <br>
                    <strong>type:</strong> ${order.orderName} <br>
                    <strong>comment:</strong> ${order.comment}
                  </p>
                  <p><b><a href="${process.env.BASEURL}/order/${order.orderId}">${process.env.BASEURL}/order/${order.orderId}</a></b></p>  
                </div>
                <div id="footer"><p><small>This is an automatically generated email</small></p></div>
              ` // html body
          };
          transporter.sendMail(mailOptionsAdmin, function(error, info){
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
    res.render('order', {order: payment}); 
  });
});

app.all('/thanks', function(req, res){
  var paymentId = req.session.paymentId; 
  Order.findOne({orderId: paymentId}, function(err, order) {
    if (err) {
      console.log(err);
      res.render('payment-error', { payment: order.order });
    }else {
      res.render('executed-payment', { payment: order.order });
    }
  });
});

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
