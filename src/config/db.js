

const {ENV} = require('../config')
// this is for locally installed mongodb
//module.exports = {
//   url: "mongodb://0.0.0.0:27017/",
//   database: "local",
//   imgBucket: "image",
// };
const url = ENV === "prod" ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI_DEV
const config = {
  url: ENV === "prod" ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI_DEV,
  database: "Data1",
  imgBucket: "pictures",
};
module.exports = config