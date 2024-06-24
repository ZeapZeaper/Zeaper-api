/**
 * environment configuration, it uses default values if they are not defined on the nodejs process.
 */
module.exports = {
  ENV: process.env.ENV || "dev",
  PORT: process.env.PORT || 8080,
};
