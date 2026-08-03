const errorMiddleware = require('./src/middlewares/errorMiddleware');
const campaignRoute = require('./src/routes/user.campaign.route');
const visitorsRoute = require('./src/routes/user.visitor.route');
const scriptRoute = require('./src/routes/script.route')
const userRoute = require('./src/routes/user.route');
const campaignScheduleRoute = require('./src/routes/campaignSchedule.routes');
const scheduleUserCleanup = require('./src/crons/userCleanup.cron');
const scheduleSubscriptionDeactivation = require('./src/crons/subscriptionDeactivation.cron');
const { startScheduler } = require('./src/scheduler/campaignScheduler');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const connectDB = require('./src/configs/db');
const scriptModel = require('./src/models/scriptModel');
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
  // Allow every origin, with or without one present (curl/mobile apps send
  // no Origin header at all) — reflects the actual request origin back
  // rather than a literal "*", which is what's required when credentials
  // are involved. This API serves a tracking script embedded on arbitrary
  // customer websites, so there's no fixed allowlist to check against.
  origin: true,
  credentials: true, // Allow cookies and authentication headers
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  // No allowedHeaders list: leaving it unset makes the `cors` package
  // reflect back whatever the browser's preflight actually asked for
  // (Access-Control-Request-Headers) instead of rejecting anything not on
  // a fixed list — i.e. every header is allowed.
  exposedHeaders: ['Content-Length', 'X-Requested-With']
}));
app.set('trust proxy', 1);
// app.use(limiter);

// Per-campaign and per-client (`-main.js`) scripts are stored in Mongo
// (see scriptModel.js) — that's what actually survives a redeploy, since
// Render's filesystem is ephemeral. Check the DB first; anything not found
// there falls through to express.static below, which covers the
// hand-written utility scripts (form tracking, etc.) that are committed to
// git and don't need database backing.
app.get('/scripts/:filename', async (req, res, next) => {
  try {
    const doc = await scriptModel.findOne({ name: req.params.filename, isDelete: { $ne: true } }).select('content');
    if (doc && doc.content) {
      return res.type('application/javascript').send(doc.content);
    }
  } catch (err) {
    console.error('[scripts] DB lookup failed, falling back to static file:', err.message);
  }
  next();
});
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
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
  // Reflect back whatever headers this specific preflight asked for,
  // instead of a fixed list — so any header is allowed here too.
  res.header('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  res.sendStatus(200);
});

app.use('/api', route)
app.use('/api/v2', userRoute);
app.use('/api/v2/campaign', campaignRoute);
app.use('/api/v2/visitors', visitorsRoute);
app.use('/api/v2/script', scriptRoute);
app.use('/api/v2/campaign-schedule', campaignScheduleRoute);

app.listen(port, async () => {
  try {
    await connectDB()
      .then(() => {
        scheduleUserCleanup();
        scheduleSubscriptionDeactivation();
        startScheduler(); // Campaign scheduling — see src/scheduler/campaignScheduler.js
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