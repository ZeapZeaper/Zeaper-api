// const multer = require("multer");
// //const util = require("util");

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "uploads");
//   },
//   filename: (req, file, cb) => {
//     console.log("fileeee", file);
//     cb(null, file.fieldname + "-" + Date.now());
//   },
// });

// const upload = multer({ storage: storage });

// module.exports = upload;
const root = require("../../root");
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const dbConfig = require("../config/db");
const path = require("path");
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(root + "/uploads/"));
  },

  filename: function (req, file, cb) {
    cb(
      null,
      new Date().toISOString().replace(/:/g, "-") + "-" + file.originalname
    );
  },
});

const validateFileSizes = (request, response, next) => {
  if (request.fileValidationError) {
    return response.status(400).json({ error: request.fileValidationError });
  }
  if (request?.file) {
    if (request.file.size > 1500 * 1500 * 1) {
      return response
        .status(400)
        .json({ error: "File is too large. Max file size is 1.5MB" });
    }
  }
  if (request?.files) {
    const images = request.files.images;
    console.log("images", images);
    if (!images) {
      return response.status(400).json({ error: "No files uploaded" });
    }
    let valid = true;
    images.forEach((file) => {
      if (file.size > 1500 * 1500 * 1) {
        valid = false;
      }
    });
    if (!valid) {
      return response
        .status(400)
        .json({
          error: "one or more files are too large. Max file size is 1.5MB",
        });
    }
  }

  next();
};

const upload = multer({
  storage: storage,
  // limits: {
  //   fileSize: 1024 * 1024 * 5,
  // },
}).single("file");

const uploadMultiple = multer({
  storage: storage,
  // limits: {
  //   fileSize: 1024 * 1024 * 1,
  // },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype == "image/png" ||
      file.mimetype == "image/jpg" ||
      file.mimetype == "image/jpeg" ||
      file.mimetype == "image/webp" ||
      file.mimetype == "image/avif"
    ) {
      cb(null, true);
    } else {
      req.fileValidationError =
        "Only .png, .jpg, .jpeg, .webp and .avif format allowed!";
      return cb(null, false, req.fileValidationError);
    }
  },
});

// saving the image on uploads folder to fasten loaden of images

// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, 'uploads')
//     },
//     filename: (req, file, cb) => {
//         console.log("passed here");
//         cb(null, file.fieldname + '-e-stocker-' + Date.now())
//     }
// });

// const upload = multer({ storage: storage });

// Will use this if I later decide to save the images in the mongodb

// const storage = new GridFsStorage({
//   url: dbConfig.url,
//   options: { useNewUrlParser: true, useUnifiedTopology: true },
//   file: (req, file) => {
//     console.log("passed here");
//     const match = ["image/png", "image/jpeg"];

//     if (match.indexOf(file.mimetype) === -1) {
//       const filename = `${Date.now()}-e-stocker-${file.originalname}`;
//       return filename;
//     }

//     return {
//       bucketName: dbConfig.imgBucket,
//       filename: `${Date.now()}-e-stocker-${file.originalname}`,
//     };
//   },
// });

module.exports = { upload, uploadMultiple, validateFileSizes };
