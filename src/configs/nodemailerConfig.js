const nodemailer = require("nodemailer");

const sendEmail = async (option) => {

  // const transporter = nodemailer.createTransport({
  //   host: "bh-in-11.webhostbox.net",
  //   port: process.env.EMAIL_PORT,
  //   auth: {
  //     user: process.env.EMAIL_USERNAME,
  //     pass: process.env.EMAIL_PASSWORD,
  //   },
  // });

  const transporter = nodemailer.createTransport({
      host:'smtp.gmail.com',
      port:587, 
      secure: false,  
      auth: {
          user:'hey@mimz.com',
          pass:'paez tfsp rjvv dfib',
      },
      tls: {
          rejectUnauthorized: false,
      },
  });
  

  const emailOptions = {
    from: 'hey@mimz.com',
    to: option.email,
    subject: option.subject,
    text: option.message,
  };

  await transporter.sendMail(emailOptions);

};

module.exports = sendEmail;
