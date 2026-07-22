const passwordResetTemplate = (user, link) => {
    return `<!doctype html>
    <html lang="en-US">
    
    <head>
        <meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
        <title>Reset Your Password</title>
        <meta name="description" content="Reset Your Password">
        <style type="text/css">
            a:hover {
                text-decoration: underline !important;
            }
        </style>
    </head>
    
    <body style="margin: 0px; background-color: #f2f3f8;">
        <table cellspacing="0" border="0" cellpadding="0" width="100%" bgcolor="#f2f3f8"
            style="font-family: 'Open Sans', sans-serif;">
            <tr>
                <td>
                    <table style="background-color: #f2f3f8; max-width:670px; margin:0 auto;" width="100%" border="0"
                        align="center" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="height:80px;">&nbsp;</td>
                        </tr>
                        <tr>
                            <td>
                                <table width="95%" border="0" align="center" cellpadding="0" cellspacing="0"
                                    style="max-width:670px;background:#fff; border-radius:3px; text-align:center;box-shadow:0 6px 18px 0 rgba(0,0,0,.06);">
                                    <tr>
                                        <td style="padding: 35px 35px; text-align:left; background-color: #ffffff;">
                                            <a href="">
                                                <img style="width: 200px; background-color: #ffffff;" src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRkdRRxMNkG5hyvH3vdJWR99RplqIhJG8j2ZERwqjaz&s" alt="logo">
                                            </a>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding:0 35px;">
                                            <h1 style="color:#1e1e2d; font-weight:500; margin:0;font-size:32px;font-family:'Rubik',sans-serif;">
                                                Reset Your Password</h1>
                                            <span style="display:inline-block; margin:29px 0 26px; border-bottom:1px solid #cecece; width:100px;"></span>
                                            <p style="color:#455056; font-size:15px;line-height:24px; margin:0;">
                                                Hi <strong>${user}</strong>, we received a request to reset your password.
                                                Click the button below to proceed.
                                            </p>
                                            <a href="${link}" target="_blank"
                                                style="background:#20e277;text-decoration:none !important; font-weight:500; margin-top:35px; color:#fff;text-transform:uppercase; font-size:14px;padding:10px 24px;display:inline-block;border-radius:50px;">
                                                Reset Password</a>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="height:40px;">&nbsp;</td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="height:80px;">&nbsp;</td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    
    </html>`;
};

const welcomeEmailTemplate = (userName, userEmail) => {
    return `<!doctype html>
    <html lang="en-US">
    
    <head>
        <meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
        <title>Welcome to URLPT!</title>
        <meta name="description" content="Welcome to URLPT - Your journey to better tracking starts here">
        <style type="text/css">
            a:hover {
                text-decoration: underline !important;
            }
            .gradient-bg {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .feature-card {
                background: #ffffff;
                border-radius: 12px;
                padding: 20px;
                margin: 10px 0;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                border-left: 4px solid #667eea;
            }
            .cta-button {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 15px 30px;
                border-radius: 50px;
                text-decoration: none;
                display: inline-block;
                font-weight: 600;
                font-size: 16px;
                transition: transform 0.3s ease;
            }
            .cta-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 15px rgba(102, 126, 234, 0.4);
            }
        </style>
    </head>
    
    <body style="margin: 0px; background-color: #f8fafc;">
        <table cellspacing="0" border="0" cellpadding="0" width="100%" bgcolor="#f8fafc"
            style="font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <tr>
                <td>
                    <table style="background-color: #f8fafc; max-width:680px; margin:0 auto;" width="100%" border="0"
                        align="center" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="height:40px;">&nbsp;</td>
                        </tr>
                        
                        <!-- Header with Gradient -->
                        <tr>
                            <td>
                                <table width="95%" border="0" align="center" cellpadding="0" cellspacing="0"
                                    style="max-width:680px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 20px 20px 0 0; text-align:center; box-shadow: 0 10px 30px rgba(0,0,0,.15);">
                                    <tr>
                                        <td style="padding: 40px 35px 30px; text-align:center;">
                                            <img style="width: 180px; background-color: transparent;" src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRkdRRxMNkG5hyvH3vdJWR99RplqIhJG8j2ZERwqjaz&s" alt="URLPT Logo">
                                            <h1 style="color:#ffffff; font-weight:700; margin:20px 0 10px; font-size:36px; font-family:'Inter', sans-serif; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                                                🎉 Welcome to URLPT!
                                            </h1>
                                            <p style="color:#e2e8f0; font-size:18px; margin:0; font-weight:400;">
                                                Your journey to better website tracking starts now
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        
                        <!-- Main Content -->
                        <tr>
                            <td>
                                <table width="95%" border="0" align="center" cellpadding="0" cellspacing="0"
                                    style="max-width:680px; background:#ffffff; border-radius: 0 0 20px 20px; box-shadow: 0 10px 30px rgba(0,0,0,.15);">
                                    
                                    <!-- Welcome Message -->
                                    <tr>
                                        <td style="padding: 40px 35px 20px;">
                                            <h2 style="color:#1e293b; font-weight:600; margin:0 0 20px; font-size:24px; font-family:'Inter', sans-serif;">
                                                Hi ${userName}! 👋
                                            </h2>
                                            <p style="color:#475569; font-size:16px; line-height:28px; margin:0 0 25px;">
                                                Thank you for joining URLPT! We're thrilled to have you on board. You've just taken the first step towards 
                                                <strong>better website tracking</strong>, <strong>enhanced user insights</strong>, and <strong>improved conversion rates</strong>.
                                            </p>
                                        </td>
                                    </tr>
                                    
                                    <!-- Features Section -->
                                    <tr>
                                        <td style="padding: 0 35px 20px;">
                                            <h3 style="color:#1e293b; font-weight:600; margin:0 0 20px; font-size:20px; font-family:'Inter', sans-serif;">
                                                🚀 What you can do with URLPT:
                                            </h3>
                                            
                                            <div class="feature-card">
                                                <h4 style="color:#667eea; font-weight:600; margin:0 0 8px; font-size:16px;">📊 Advanced Analytics</h4>
                                                <p style="color:#64748b; font-size:14px; margin:0; line-height:22px;">Track visitor behavior, page views, and user interactions in real-time.</p>
                                            </div>
                                            
                                            <div class="feature-card">
                                                <h4 style="color:#667eea; font-weight:600; margin:0 0 8px; font-size:16px;">🎯 Campaign Management</h4>
                                                <p style="color:#64748b; font-size:14px; margin:0; line-height:22px;">Create and manage targeted campaigns to boost your conversions.</p>
                                            </div>
                                            
                                            <div class="feature-card">
                                                <h4 style="color:#667eea; font-weight:600; margin:0 0 8px; font-size:16px;">📧 Email Automation</h4>
                                                <p style="color:#64748b; font-size:14px; margin:0; line-height:22px;">Send personalized emails based on user behavior and preferences.</p>
                                            </div>
                                            
                                            <div class="feature-card">
                                                <h4 style="color:#667eea; font-weight:600; margin:0 0 8px; font-size:16px;">🔍 Visitor Insights</h4>
                                                <p style="color:#64748b; font-size:14px; margin:0; line-height:22px;">Get detailed insights about your website visitors and their journey.</p>
                                            </div>
                                        </td>
                                    </tr>
                                    
                                    <!-- CTA Section -->
                                    <tr>
                                        <td style="padding: 20px 35px 30px; text-align:center;">
                                            <h3 style="color:#1e293b; font-weight:600; margin:0 0 15px; font-size:18px; font-family:'Inter', sans-serif;">
                                                Ready to get started?
                                            </h3>
                                            <p style="color:#64748b; font-size:15px; margin:0 0 25px; line-height:24px;">
                                                Complete your setup in just a few simple steps and start tracking your website visitors today!
                                            </p>
                                            <a href="https://app.mimz.com/dashboard" class="cta-button" style="text-decoration:none; color:#ffffff;">
                                                🚀 Go to Dashboard
                                            </a>
                                        </td>
                                    </tr>
                                    
                                    <!-- Support Section -->
                                    <tr>
                                        <td style="padding: 20px 35px 30px; background-color: #f8fafc; border-radius: 0 0 20px 20px;">
                                            <div style="text-align:center; padding: 20px; background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); border-radius: 12px;">
                                                <h4 style="color:#1e293b; font-weight:600; margin:0 0 10px; font-size:16px;">💬 Need Help?</h4>
                                                <p style="color:#64748b; font-size:14px; margin:0 0 15px; line-height:22px;">
                                                    Our support team is here to help you succeed. Don't hesitate to reach out!
                                                </p>
                                                <p style="color:#667eea; font-size:14px; margin:0; font-weight:500;">
                                                    📧 support@technians.com | 📞 +91-98999 20599

                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="padding: 30px 35px; text-align:center;">
                                <p style="color:#94a3b8; font-size:13px; margin:0 0 10px; line-height:20px;">
                                    This email was sent to <strong>${userEmail}</strong> because you created an account with URLPT.
                                </p>
                                <p style="color:#94a3b8; font-size:12px; margin:0; line-height:18px;">
                                    © 2024 Technians SofTech Private Limited. All rights reserved.<br>
                                    Made with ❤️ in India
                                </p>
                            </td>
                        </tr>
                        
                        <tr>
                            <td style="height:40px;">&nbsp;</td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    
    </html>`;
};

const cancellationEmailTemplate = (userName, planName, endDate, cancellationReason) => {
    return `<!doctype html>
    <html lang="en-US">
    <head>
        <meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
        <title>Subscription Cancelled - URLPT</title>
        <meta name="description" content="Your subscription has been cancelled" />
        <style type="text/css">
            a:hover { text-decoration: underline !important; }
        </style>
    </head>
    <body marginheight="0" topmargin="0" marginwidth="0" style="margin: 0px; background-color: #f2f3f8;" leftmargin="0">
        <table cellspacing="0" border="0" cellpadding="0" width="100%" bgcolor="#f2f3f8"
            style="@import url(https://fonts.googleapis.com/css?family=Rubik:300,400,500,700|Open+Sans:300,400,600,700); font-family: 'Open Sans', sans-serif;">
            <tr>
                <td>
                    <table style="background-color: #f2f3f8; max-width:670px;  margin:0 auto;" width="100%" border="0"
                        align="center" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="height:80px;">&nbsp;</td>
                        </tr>
                        <tr>
                            <td style="text-align:center;">
                                <a href="https://app.mimz.com" title="logo" target="blank">
                                    <img width="60" src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRkdRRxMNkG5hyvH3vdJWR99RplqIhJG8j2ZERwqjaz&s" title="logo" alt="logo">
                                </a>
                            </td>
                        </tr>
                        <tr>
                            <td style="height:20px;">&nbsp;</td>
                        </tr>
                        <tr>
                            <td>
                                <table width="95%" border="0" align="center" cellpadding="0" cellspacing="0"
                                    style="max-width:670px;background:#fff; border-radius:3px; text-align:center;-webkit-box-shadow:0 6px 18px 0 rgba(0,0,0,.06);-moz-box-shadow:0 6px 18px 0 rgba(0,0,0,.06);box-shadow:0 6px 18px 0 rgba(0,0,0,.06);">
                                    <tr>
                                        <td style="height:40px;">&nbsp;</td>
                                    </tr>
                                    <tr>
                                        <td style="padding:0 35px;">
                                            <h1 style="color:#1e1e2d; font-weight:500; margin:0;font-size:32px;font-family:'Rubik',sans-serif;">
                                                Subscription Cancelled
                                            </h1>
                                            <span
                                                style="display:inline-block; vertical-align:middle; margin:29px 0 26px; border-bottom:1px solid #cecece; width:100px;"></span>
                                            <p style="color:#455056; font-size:15px;line-height:24px; margin:0;">
                                                Hi ${userName},
                                            </p>
                                            <p style="color:#455056; font-size:15px;line-height:24px; margin:16px 0;">
                                                We're sorry to see you go! Your <strong>${planName}</strong> subscription has been successfully cancelled.
                                            </p>
                                            <p style="color:#455056; font-size:15px;line-height:24px; margin:16px 0;">
                                                <strong>Important:</strong> You will retain access to all premium features until <strong>${endDate}</strong>. After this date, your account will be moved to our free plan.
                                            </p>
                                            ${cancellationReason ? `
                                            <p style="color:#455056; font-size:15px;line-height:24px; margin:16px 0;">
                                                <strong>Your feedback:</strong> "${cancellationReason}"
                                            </p>
                                            ` : ''}
                                            <p style="color:#455056; font-size:15px;line-height:24px; margin:16px 0;">
                                                We value your feedback and would love to have you back. If you change your mind, you can reactivate your subscription anytime before ${endDate}.
                                            </p>
                                            <a href="https://app.mimz.com/pricing"
                                                style="background:#20e277;text-decoration:none !important; font-weight:500; margin-top:35px; color:#fff;text-transform:uppercase; font-size:14px;padding:10px 24px;display:inline-block;border-radius:50px;">
                                                Reactivate Subscription
                                            </a>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="height:40px;">&nbsp;</td>
                                    </tr>
                                </table>
                            </td>
                        <tr>
                            <td style="height:20px;">&nbsp;</td>
                        </tr>
                        <tr>
                            <td style="text-align:center;">
                                <p style="font-size:14px; color:rgba(69, 80, 86, 0.7411764705882353); line-height:18px; margin:0 0 0;">
                                    &copy; <strong>URLPT</strong>. All rights reserved.
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <td style="height:80px;">&nbsp;</td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>`;
};

const upgradeEmailTemplate = (userName, fromPlan, toPlan, upgradeCost, newEndDate) => {
    return `<!doctype html>
    <html lang="en-US">
    <head>
        <meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
        <title>Subscription Upgraded - URLPT</title>
        <meta name="description" content="Your subscription has been upgraded" />
        <style type="text/css">
            a:hover { text-decoration: underline !important; }
        </style>
    </head>
    <body marginheight="0" topmargin="0" marginwidth="0" style="margin: 0px; background-color: #f2f3f8;" leftmargin="0">
        <table cellspacing="0" border="0" cellpadding="0" width="100%" bgcolor="#f2f3f8"
            style="@import url(https://fonts.googleapis.com/css?family=Rubik:300,400,500,700|Open+Sans:300,400,600,700); font-family: 'Open Sans', sans-serif;">
            <tr>
                <td>
                    <table style="background-color: #f2f3f8; max-width:670px;  margin:0 auto;" width="100%" border="0"
                        align="center" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="height:80px;">&nbsp;</td>
                        </tr>
                        <tr>
                            <td style="text-align:center;">
                                <a href="https://app.mimz.com" title="logo" target="blank">
                                    <img width="60" src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRkdRRxMNkG5hyvH3vdJWR99RplqIhJG8j2ZERwqjaz&s" title="logo" alt="logo">
                                </a>
                            </td>
                        </tr>
                        <tr>
                            <td style="height:20px;">&nbsp;</td>
                        </tr>
                        <tr>
                            <td>
                                <table width="95%" border="0" align="center" cellpadding="0" cellspacing="0"
                                    style="max-width:670px;background:#fff; border-radius:3px; text-align:center;-webkit-box-shadow:0 6px 18px 0 rgba(0,0,0,.06);-moz-box-shadow:0 6px 18px 0 rgba(0,0,0,.06);box-shadow:0 6px 18px 0 rgba(0,0,0,.06);">
                                    <tr>
                                        <td style="height:40px;">&nbsp;</td>
                                    </tr>
                                    <tr>
                                        <td style="padding:0 35px;">
                                            <h1 style="color:#1e1e2d; font-weight:500; margin:0;font-size:32px;font-family:'Rubik',sans-serif;">
                                                🎉 Subscription Upgraded!
                                            </h1>
                                            <span
                                                style="display:inline-block; vertical-align:middle; margin:29px 0 26px; border-bottom:1px solid #cecece; width:100px;"></span>
                                            <p style="color:#455056; font-size:15px;line-height:24px; margin:0;">
                                                Hi ${userName},
                                            </p>
                                            <p style="color:#455056; font-size:15px;line-height:24px; margin:16px 0;">
                                                Congratulations! Your subscription has been successfully upgraded from <strong>${fromPlan}</strong> to <strong>${toPlan}</strong>.
                                            </p>
                                            <div style="background:#f8f9fa; padding:20px; border-radius:8px; margin:20px 0;">
                                                <h3 style="color:#1e1e2d; margin:0 0 15px 0; font-size:18px;">Upgrade Details:</h3>
                                                <p style="color:#455056; font-size:14px;line-height:20px; margin:5px 0;"><strong>From:</strong> ${fromPlan}</p>
                                                <p style="color:#455056; font-size:14px;line-height:20px; margin:5px 0;"><strong>To:</strong> ${toPlan}</p>
                                                <p style="color:#455056; font-size:14px;line-height:20px; margin:5px 0;"><strong>Upgrade Cost:</strong>$ ${Math.round(upgradeCost * 100) / 100}</p>
                                                <p style="color:#455056; font-size:14px;line-height:20px; margin:5px 0;"><strong>New Billing Cycle Ends:</strong> ${newEndDate}</p>
                                            </div>
                                            <p style="color:#455056; font-size:15px;line-height:24px; margin:16px 0;">
                                                You now have access to all premium features of the ${toPlan} plan. Your new billing cycle includes prorated days from your previous subscription.
                                            </p>
                                            <a href="https://app.mimz.com/dashboard"
                                                style="background:#20e277;text-decoration:none !important; font-weight:500; margin-top:35px; color:#fff;text-transform:uppercase; font-size:14px;padding:10px 24px;display:inline-block;border-radius:50px;">
                                                Access Dashboard
                                            </a>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="height:40px;">&nbsp;</td>
                                    </tr>
                                </table>
                            </td>
                        <tr>
                            <td style="height:20px;">&nbsp;</td>
                        </tr>
                        <tr>
                            <td style="text-align:center;">
                                <p style="font-size:14px; color:rgba(69, 80, 86, 0.7411764705882353); line-height:18px; margin:0 0 0;">
                                    &copy; <strong>URLPT</strong>. All rights reserved.
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <td style="height:80px;">&nbsp;</td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>`;
};

const downgradeEmailTemplate = (userName, fromPlan, toPlan, creditAmount, newEndDate) => {
    return `<!doctype html>
    <html lang="en-US">
    <head>
        <meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
        <title>Subscription Downgraded - URLPT</title>
        <meta name="description" content="Subscription Downgraded">
        <style type="text/css">
            a:hover {
                text-decoration: underline !important;
            }
        </style>
    </head>
    
    <body style="margin: 0px; background-color: #f2f3f8;">
        <table cellspacing="0" border="0" cellpadding="0" width="100%" bgcolor="#f2f3f8"
            style="font-family: 'Open Sans', sans-serif;">
            <tr>
                <td>
                    <table style="background-color: #f2f3f8; max-width:670px; margin:0 auto;" width="100%" border="0"
                        align="center" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="height:80px;">&nbsp;</td>
                        </tr>
                        <tr>
                            <td>
                                <table width="95%" border="0" align="center" cellpadding="0" cellspacing="0"
                                    style="max-width:670px;background:#fff; border-radius:3px; text-align:center;box-shadow:0 6px 18px 0 rgba(0,0,0,.06);">
                                    <tr>
                                        <td style="padding: 35px 35px; text-align:left; background-color: #ffffff;">
                                            <a href="">
                                                <img style="width: 200px; background-color: #ffffff;" src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRkdRRxMNkG5hyvH3vdJWR99RplqIhJG8j2ZERwqjaz&s" alt="logo">
                                            </a>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding:0 35px;">
                                            <h1 style="color:#1e1e2d; font-weight:500; margin:0;font-size:32px;font-family:'Rubik',sans-serif;">
                                                Subscription Downgraded</h1>
                                            <span style="display:inline-block; margin:29px 0 26px; border-bottom:1px solid #cecece; width:100px;"></span>
                                            <p style="color:#455056; font-size:15px;line-height:24px; margin:0;">
                                                Hi <strong>${userName}</strong>, your subscription has been successfully downgraded.
                                            </p>
                                            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                                <h3 style="color:#1e1e2d; font-weight:500; margin:0 0 15px 0;font-size:18px;">Downgrade Details:</h3>
                                                <p style="color:#455056; font-size:14px;line-height:22px; margin:5px 0;"><strong>From:</strong> ${fromPlan}</p>
                                                <p style="color:#455056; font-size:14px;line-height:22px; margin:5px 0;"><strong>To:</strong> ${toPlan}</p>
                                                <p style="color:#455056; font-size:14px;line-height:22px; margin:5px 0;"><strong>Credit Amount:</strong>$ ${creditAmount.toFixed(2)}</p>
                                                <p style="color:#455056; font-size:14px;line-height:22px; margin:5px 0;"><strong>New End Date:</strong> ${newEndDate}</p>
                                            </div>
                                            <p style="color:#455056; font-size:15px;line-height:24px; margin:0;">
                                                Your new plan is now active. The credit from your previous plan has been applied to extend your new subscription period.
                                            </p>
                                            <p style="color:#455056; font-size:15px;line-height:24px; margin:20px 0 0 0;">
                                                If you have any questions, please don't hesitate to contact our support team.
                                            </p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding:0 35px;">
                                            <p style="color:#455056; font-size:14px;line-height:24px; margin:0;">
                                                Best regards,<br>
                                                The URLPT Team
                                            </p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="height:40px;">&nbsp;</td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="height:80px;">&nbsp;</td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>`;
};

module.exports = { passwordResetTemplate, welcomeEmailTemplate, cancellationEmailTemplate, upgradeEmailTemplate, downgradeEmailTemplate };