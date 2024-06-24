require('dotenv').config()
const { ENV } = require("../config");
const firebaseAdmin = require("firebase-admin");
const config = require("../config/firebaseServiceAcc");

const firebase = firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(config),
});

const bucket =
  ENV === "prod"
    ? process.env.STORAGE_BUCKET_PROD
    : process.env.STORAGE_BUCKET_DEV;
const storageRef = firebase.storage().bucket(`${bucket}`);
module.exports = { storageRef, firebase };
