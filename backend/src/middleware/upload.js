const multer  = require('multer');
const multerS3 = require('multer-s3');
const AWS     = require('aws-sdk');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');

const s3 = new AWS.S3({
  accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region:          process.env.AWS_REGION || 'us-east-1',
});

const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.AWS_S3_BUCKET,
    acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const key = `reports/${uuidv4()}${ext}`;
      cb(null, key);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG and WebP images are allowed'));
    }
  },
});

// Fallback: local storage if S3 not configured
const localUpload = multer({
  storage: multer.diskStorage({
    destination: '/tmp/ngo-uploads',
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'));
  },
});

const uploadMiddleware = process.env.AWS_S3_BUCKET ? upload : localUpload;

module.exports = uploadMiddleware;
