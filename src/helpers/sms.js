


const axios = require("axios");
require("dotenv").config();
const { ENV } = require("../config");

const api_key =
  // ENV === "prod"
  //   ? 
    process.env.LIVE_TERMII_API_KEY
    // : 
    // process.env.TEST_TERMII_API_KEY;

const sendURL = "https://v3.api.termii.com/api/sms/otp/send";
const verifyURL = "https://v3.api.termii.com/api/sms/otp/verify";
const sender_id= "Zeap";

const sendOTP = async (param) => {
  const { to, firstName } = param;  

  const pinPlaceholder = '< 1234 >';
  const message = `Hello ${firstName}, your OTP is ${pinPlaceholder}. This pin will expire in 15 minutes.`;
  const data = {
    api_key: api_key,
    to: to,
    from: sender_id,
    channel: "generic",
    message: message,
    message_type : "NUMERIC",
       pin_attempts: 10,
    pin_time_to_live:  15,
    pin_length: 6,
    pin_placeholder: "< 1234 >",
    message_text: message,
    pin_type: "NUMERIC",

  };
  
    try{
     
       const response = await axios.post (sendURL, data)
        return response.data
        
        
  }

    catch(err){

       const error = err.response.data?.message
       console.log("error", error);
        if(error){
          throw new Error(error.substring(error.indexOf(":") + 3).trim().replace(/['"]+/g, ''));
        }
    }

};


const verifyOTP = async (param) => {
  const { pin_id, pin } = param;
  const data = {
    api_key: api_key,
    pin_id: pin_id,
    pin: pin,
  };
  try {
    const response = await axios.post(verifyURL, data)
    console.log("response", response.data);
    return response.data;
  } catch (err) {
   

    throw err;
  }
};

module.exports = {
  sendOTP,
  verifyOTP,
};





