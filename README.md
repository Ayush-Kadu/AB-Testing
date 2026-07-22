# URLPT Backend

A robust Node.js/Express.js backend API for the URLPT SaaS platform, providing comprehensive campaign management, user analytics, and marketing automation services. Built with MongoDB, JWT authentication, and modern security practices.

![URLPT Backend](https://img.shields.io/badge/Node.js-18.x-green)
![URLPT Backend](https://img.shields.io/badge/Express.js-4.18.2-blue)
![URLPT Backend](https://img.shields.io/badge/MongoDB-8.0.0-green)

## 🚀 Features

### Core API Services
- **Authentication & Authorization** - JWT-based secure authentication with role-based access
- **Campaign Management** - Complete CRUD operations for marketing campaigns
- **User Analytics** - Visitor tracking, conversion monitoring, and behavioral analytics
- **Template System** - Email template management with dynamic content generation
- **Payment Integration** - Razorpay integration for subscription management
- **Script Generation** - Dynamic JavaScript tracking script generation for websites
- **Email & SMS Services** - SendGrid and Twilio integration for communications
- **Cron Jobs** - Automated tasks for user cleanup and subscription management

### Security Features
- **Rate Limiting** - API rate limiting to prevent abuse
- **CORS Configuration** - Secure cross-origin resource sharing
- **Input Validation** - Express-validator for request validation
- **Error Handling** - Centralized error handling middleware
- **IP Tracking** - User IP tracking for security and analytics
- **Password Hashing** - bcrypt for secure password storage

### Integration Services
- **AWS SDK** - File storage and cloud services
- **Puppeteer** - Web scraping and automation
- **PDF Generation** - PDFKit for document generation
- **Crypto Services** - Encryption and decryption utilities

## 🛠️ Tech Stack

- **Runtime**: Node.js 14.x+
- **Framework**: Express.js 4.18.2
- **Database**: MongoDB 8.0.0 with Mongoose ODM
- **Authentication**: JWT (jsonwebtoken 9.0.2)
- **Security**: bcrypt 5.1.1, express-rate-limit 7.5.0
- **Validation**: express-validator 7.0.1
- **File Upload**: express-fileupload 1.5.1
- **Email**: Nodemailer 6.9.9, SendGrid 8.1.5
- **SMS**: Twilio 4.22.0, Plivo 4.70.0
- **Payment**: Razorpay 2.9.2
- **Scheduling**: node-cron 3.0.3
- **Utilities**: moment-timezone 0.5.47, crypto-js 4.2.0

## 📦 Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB database (local or cloud)
- npm or yarn package manager

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   PORT=5006
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/urlpt
   JWT_SECRET=your_jwt_secret_key
   RAZORPAY_KEY_ID=your_razorpay_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_secret
   SENDGRID_API_KEY=your_sendgrid_api_key
   TWILIO_ACCOUNT_SID=your_twilio_account_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   AWS_ACCESS_KEY_ID=your_aws_access_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret_key
   AWS_REGION=your_aws_region
   ```

4. **Start development server**
   ```bash
   npm start
   ```

5. **Verify server is running**
   Navigate to `http://localhost:5006` - should return server status

## 🏗️ Project Structure

```
backend/
├── src/
│   ├── configs/           # Database and service configurations
│   │   ├── db.js         # MongoDB connection
│   │   └── nodemailerConfig.js
│   ├── controllers/      # Request handlers and business logic
│   │   ├── authController.js
│   │   ├── campaignControllers.js
│   │   ├── userControllers.js
│   │   └── [+15 more controllers]
│   ├── middlewares/      # Custom middleware functions
│   │   ├── auth.js       # JWT authentication
│   │   ├── adminMiddleware.js
│   │   └── errorMiddleware.js
│   ├── models/           # MongoDB schemas and models
│   │   ├── user.model.js
│   │   ├── user.campaign.model.js
│   │   ├── templateModel.js
│   │   └── [+25 more models]
│   ├── routes/           # API route definitions
│   │   ├── routes.js     # Main router
│   │   ├── authRoutes.js
│   │   ├── campaignRoutes.js
│   │   └── [+15 more route files]
│   ├── utils/            # Utility functions and helpers
│   │   ├── errorHandler.js
│   │   ├── mailer.js
│   │   ├── scriptUtils.js
│   │   └── helper.js
│   ├── validators/       # Request validation schemas
│   ├── crons/            # Scheduled tasks
│   ├── scripts/          # Generated tracking scripts
│   └── template/         # Email templates
├── index.js              # Main server file
└── package.json          # Dependencies and scripts
```

## 🚀 Available Scripts

- `npm start` - Start development server with nodemon
- `npm run build` - Build for production (if using Babel)
- `npm run dev` - Start development server

## 📡 API Endpoints

### Authentication Routes (`/auth`)
- `POST /auth/login` - User login
- `POST /auth/signup` - User registration
- `POST /auth/forgot-password` - Password reset request
- `POST /auth/reset-password` - Password reset
- `GET /auth/me` - Get current user profile
- `POST /auth/logout` - User logout

### Campaign Routes (`/campaign`)
- `GET /campaign` - Get all campaigns
- `POST /campaign` - Create new campaign
- `GET /campaign/:id` - Get campaign by ID
- `PUT /campaign/:id` - Update campaign
- `DELETE /campaign/:id` - Delete campaign
- `POST /campaign/:id/trigger` - Trigger campaign
- `GET /campaign/:id/stats` - Get campaign statistics

### Template Routes (`/templates`)
- `GET /templates` - Get all templates
- `POST /templates` - Create new template
- `GET /templates/:id` - Get template by ID
- `PUT /templates/:id` - Update template
- `DELETE /templates/:id` - Delete template

### Visitor Routes (`/visitors`)
- `GET /visitors` - Get visitor analytics
- `POST /visitors/track` - Track visitor activity
- `GET /visitors/stats` - Get visitor statistics

### Payment Routes (`/payment`)
- `POST /payment/create-order` - Create Razorpay order
- `POST /payment/verify` - Verify payment
- `GET /payment/transactions` - Get transaction history

### User Profile Routes (`/userProfile`)
- `GET /userProfile` - Get user profile
- `PUT /userProfile` - Update user profile
- `POST /userProfile/website` - Add website

### Script Routes (`/script`)
- `GET /script/:userId` - Get tracking script for user
- `POST /script/generate` - Generate new tracking script

## 🔧 Configuration

### Database Configuration
MongoDB connection is configured in `src/configs/db.js`:
```javascript
const connectDB = async () => {
    const url = process.env.MONGODB_URI;
    try {
        const connect = await mongoose.connect(url);
        console.log(`MongoDB connected at host ${connect.connection.host}`);
    } catch (error) {
        console.log(`error ${error.message}`);
    }
}
```

### CORS Configuration
Configured to allow cross-origin requests for tracking scripts:
```javascript
app.use(cors({
  origin: function (origin, callback) {
    // Allow all origins for tracking script functionality
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));
```

### Rate Limiting
API rate limiting to prevent abuse:
```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    status: 429,
    message: "Too many requests, please try again later.",
  },
});
```

## 🔐 Security Features

### Authentication
- JWT-based authentication with secure token generation
- Password hashing using bcrypt
- Role-based access control (Admin/User)
- Session management and auto-logout

### Data Protection
- Input validation using express-validator
- SQL injection prevention through Mongoose
- XSS protection through proper data sanitization
- CORS configuration for secure cross-origin requests

### API Security
- Rate limiting to prevent abuse
- Request IP tracking for security monitoring
- Error handling without exposing sensitive information
- Secure file upload handling

## 📊 Database Models

### Core Models
- **User** - User accounts and profiles
- **Campaign** - Marketing campaigns and configurations
- **Template** - Email templates and designs
- **Visitor** - Visitor tracking and analytics
- **Transaction** - Payment transactions and history
- **Subscription** - User subscription management

### Analytics Models
- **LoginHistory** - User login tracking
- **EmailActivity** - Email campaign activity
- **SMSActivity** - SMS campaign activity
- **Conversion** - Conversion tracking
- **VisitorData** - Detailed visitor analytics

### Admin Models
- **AdminAccount** - Admin user management
- **AdminSetting** - System configuration
- **Package** - Subscription packages
- **Segment** - User segmentation

## 🔄 Cron Jobs

### Automated Tasks
- **User Cleanup** - Remove inactive users
- **Subscription Deactivation** - Handle expired subscriptions
- **Data Maintenance** - Clean up old analytics data

## 🚀 Deployment

### Production Build
```bash
npm start
```

### Environment Variables
Make sure to set all required environment variables in production:
- Database connection string
- JWT secret key
- Payment gateway credentials
- Email/SMS service credentials
- AWS credentials (if using)

### Monitoring
- Server uptime tracking
- Error logging and monitoring
- API performance metrics
- Database connection monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- Follow Node.js best practices
- Use async/await for asynchronous operations
- Implement proper error handling
- Write meaningful commit messages
- Add JSDoc comments for complex functions

## 📝 License

This project is proprietary software owned by URLPT. Commercial use requires licensing and payment. See the [LICENSE](LICENSE) file for detailed terms and restrictions.

**For licensing inquiries:** gaurav@technians.com

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the API documentation
- Review the controller and model files for implementation details

## 🔗 Related Links

- [Frontend Repository](../frontend/README.md)
- [API Documentation](./docs/api.md)
- [Database Schema](./docs/schema.md)

---

**Built with ❤️ using Node.js, Express.js, and MongoDB**

Prepared by: Prince Sachdeva
