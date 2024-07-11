const request = require("request");
require("dotenv").config();
const { ENV } = require("../config");

const api_key =
  ENV === "prod"
    ? process.env.LIVE_TERMII_API_KEY
    : process.env.TEST_TERMII_API_KEY;

const sendURL = "https://https://v3.api.termii.com/api/sms/otp/send";
const verifyURL = "https://https://v3.api.termii.com/api/sms/otp/verify";

const sendOTP = async (param) => {
  const { to } = param;
  const data = {
    api_key,
    message_type: "NUMERIC",
    to,
    from: "Approved Sender ID or Configuration ID",
    channel: "dnd",
    pin_attempts: 10,
    pin_time_to_live:  15,
    pin_length: 6,
    pin_placeholder: "< 1234 >",
    message_text: "Your pin is < 1234 >",
    pin_type: "NUMERIC",
  };
  const options = {
    method: "POST",
    url: sendURL,
    headers: {
      "Content-Type": ["application/json", "application/json"],
    },
    body: JSON.stringify(data),
  };
  request(options, function (error, response) {
    if (error) throw new Error(error);
    console.log(response.body);
  });
};

const verifyOTP = async (param) => {
  const { pin_id, pin } = param;
  const data = {
    api_key: api_key,
    pin_id: pin_id,
    pin: pin,
  };
  const options = {
    method: "POST",
    url: verifyURL,
    headers: {
      "Content-Type": ["application/json", "application/json"],
    },
    body: JSON.stringify(data),
  };
  request(options, function (error, response) {
    if (error) throw new Error(error);
    console.log(response.body);
  });
};

module.exports = {
  sendOTP,
  verifyOTP,
};
