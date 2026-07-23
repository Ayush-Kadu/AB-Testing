const errorMiddleware = require('./src/middlewares/errorMiddleware');
const campaignRoute = require('./src/routes/user.campaign.route');
const visitorsRoute = require('./src/routes/user.visitor.route');
const scriptRoute = require('./src/routes/script.route')
const userRoute = require('./src/routes/user.route');
const scheduleUserCleanup = require('./src/crons/userCleanup.cron');
const scheduleSubscriptionDeactivation = require('./src/crons/subscriptionDeactivation.cron');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const connectDB = require('./src/configs/db');
const route = require('./src/routes/routes');
const moment = require('moment-timezone');
const bodyParser = require('body-parser');
const requestIp = require("request-ip");
const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const app = express();
require('dotenv').config();
const path = require('path');
app.use(fileUpload());
require("./src/jobs/subscriptionJob"); //   this runs the cron for alert of subscription

//const subscriptionJob = require('./src/jobs/subscriptionJob');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    status: 429,
    message: "Too many requests, please try again later.",
  },
});

// app.use(limiter);

//for specific API 
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50,
  message: 'Too many attempts, please try again AFTER 1 MINUTE.',
});


const port = process.env.PORT || 5006;

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const client = require('twilio')(accountSid, authToken);

const serverStartTime = moment().tz('Asia/Kolkata').format('DD-MM-YYYY, hh:mm A');

app.use(requestIp.mw());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.json());
app.use(cookieParser());
// Configure CORS for cross-origin requests from client websites
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // For production: Allow all origins since users can register any domain
    // This is necessary for a tracking script that works on any website
    callback(null, true);

    // Log the origin for monitoring (optional)
    console.log('CORS request from origin:', origin);
  },
  credentials: true, // Allow cookies and authentication headers
  // methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], // ✅ add PATCH here
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Requested-With']
}));
app.set('trust proxy', 1);
// app.use(limiter);
app.use('/scripts', express.static(path.join(__dirname, 'src/scripts')));


app.get('/', (req, res) => {
  const serverName = "URLPT server";
  res.json({
    upTime: serverStartTime,
    serverName: serverName
  });
});

app.post("/send-message", (req, res) => {
  const { body, to } = req.body;
  client.messages
    .create({
      body,
      to,
      from: '+19203755303', // Your Twilio number
    })
    .then((message) => {
      console.log("Message sent:", message.sid);
      res.status(200).send("Message sent successfully");
    })
    .catch((error) => {
      console.error("Error sending message:", error);
      res.status(500).send("Failed to send message");
    });
});
app.post("/send-whatsapp", (req, res) => {
  const { body, to } = req.body;

  client.messages
    .create({
      body: 'Your appointment is coming up on July 21 at 3PM',
      from: 'whatsapp:+14155238886',
      to: 'whatsapp:+917007652088'
    })

    .then((message) => {
      console.log("Message sent:", message.sid);
      res.status(200).send("Message sent successfully");
    })
    .catch((error) => {
      console.error("Error sending message:", error);
      res.status(500).send("Failed to send message");
    });
});

// Log all incoming requests for debugging (especially CORS)
app.use('/api', (req, res, next) => {
  if (req.method === 'OPTIONS' || req.path.includes('waba-accounts')) {
    console.log('🌐 [REQUEST]', {
      method: req.method,
      path: req.path,
      origin: req.headers.origin,
      url: req.url,
      timestamp: new Date().toISOString()
    });
  }
  
  // Set longer timeout for WABA accounts endpoint
  if (req.path.includes('waba-accounts')) {
    req.setTimeout(300000); // 5 minutes
    res.setTimeout(300000); // 5 minutes
  }
  
  next();
});

// Catch-all OPTIONS handler for CORS preflight (before routes)
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  console.log('🔧 [CORS] Catch-all OPTIONS handler', {
    origin,
    url: req.url,
    path: req.path,
    timestamp: new Date().toISOString()
  });
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  res.sendStatus(200);
});

app.use('/api', route)
app.use('/api/v2', userRoute);
app.use('/api/v2/campaign', campaignRoute);
app.use('/api/v2/visitors', visitorsRoute);
app.use('/api/v2/script', scriptRoute);

app.listen(port, async () => {
  try {
    await connectDB()
      .then(() => {
        scheduleUserCleanup();
        scheduleSubscriptionDeactivation();
     //   subscriptionJob();
      })
      .catch((err) => {
        console.error("DB connection failed:", err);
      });
    console.log(`Our application is running at port: http://localhost:${port}`);
  } catch (error) {
    console.log("error", error);
  }
});


app.use(errorMiddleware)