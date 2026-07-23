const AWS = require('aws-sdk');

// Configure AWS SDK
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();

function uploadFileToS3(file, filePath) {
  const params = {
    Bucket: "urlpt-assets",
    Key: `${filePath}/${file.name}`,
    Body: file.data,
    ContentType: file.mimetype,
  };

  return new Promise((resolve, reject) => {
    s3.upload(params, (err, data) => {
      if (err) {
        console.error('Error uploading file:', err);
        return reject(err);
      }
      console.log('File uploaded successfully:', data.Location);
      resolve(data.Location);
    });
  });
}

module.exports = { uploadFileToS3 };
