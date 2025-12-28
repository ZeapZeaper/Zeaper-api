const { ENV } = require("../config");
const request = require("request");

const secretKey =
  ENV === "dev"
    ? process.env.PAYSTACK_SECRET_TEST_KEY
    : process.env.PAYSTACK_SECRET_LIVE_KEY;

const verifyPaystack = (ref, mycallback) => {
  const options = {
    url:
      "https://api.paystack.co/transaction/verify/" + encodeURIComponent(ref),
    headers: {
      authorization: `Bearer ${secretKey}`,
      "content-type": "application/json",
      "cache-control": "no-cache",
    },
  };

  request(options, (error, response, body) => {
    mycallback(error, body);
  });
};

function verifyPaystackPayment(reference) {
  return new Promise((resolve, reject) => {
    verifyPaystack(reference, (error, body) => {
      if (error) return reject(error);

      try {
        const parsed = JSON.parse(body);

        if (!parsed.status || !parsed.data) {
          return reject(new Error("Payment not successful"));
        }

        const data = parsed.data;
        const auth = data.authorization || {};

        resolve({
          status: "success",
          normalizedData: {
            paidAt: new Date(data.paidAt || data.transaction_date),
            channel: data.channel,
            currency: data.currency?.toUpperCase(),
            transactionDate: data.transaction_date,
            log: data.log || [],
            fees: data.fees || 0,
            cardType: auth.card_type || "",
            bank: auth.bank || "",
            countryCode: auth.country_code || "",
            gatewayResponse: data.gateway_response || "",
            gateway: "paystack",
          },
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}

module.exports = {
  verifyPaystack,
  verifyPaystackPayment,
};
