// {
//     "type": "service_account",
//     "project_id": "e-log-735d8",
//     "private_key_id": "0694527eb40648a29c7c2a977e5c119d3647aa16",
//     "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQClDvGBqgi5x8qT\n57JqAhBtW/LhIS6CvwWHraWS8i5XCvYDwbNiCASNHpwCJ/ujGzsIt3KHKVhrV8GL\nDeVOKccg5zAO97JgWY0LAYu+cEHbRt3MeNdvdOLo2N5L6LSV70vvr/EOJeRrFYxO\nw9Q620mzBRpfsth2wd56ETuy1ums+1clE6BBUaNZKp4EE6SPXXQjbQIa1u37+fBg\nFqQ3VCTKnRHuYomge5EjZISxgwje2Ck9rHjOAt+uWr7xnBcnLAYr3RukXIWGdq/l\n/VFP5e91BL08MdvidF480lJxfsMBc/iF2s1VJC9729Mt2sFp0c8FMjbXIzCoYoKM\nitw+fI2bAgMBAAECggEAJr/K16ds0/yA5Nckjfl9FMdczhhlnGEu8arE76n2Ug3r\nMneTXsTGGMEiW+k6DJEUe1fhxbRhoxWfhL8W4ZIyQtmzcRgaYr8zOu26elNNSqao\n5FtMLEjTCln7WfPADWD3wUXbP/iKVs9guI8FsGmRtDrS9bt9UOfzjFGmY7ZLdoXM\nYEj5g3/hWtyi4+3e0COWGdpsVWaZlJfaLXM03WmUedcc/8pMTYzwZad3J1o5n506\nq7oYiUvrsmJ7qtg2AxunHT55Mc7iAks3+o852noh1+o48Vupg2r3KmzKPNlyjTuV\nRBu07DeGw/KFRGk1fzUqhPe+eINBktYqWChUwn4XeQKBgQDT9rN1jml3GjsrBxi6\nUQ++EPY8liORxRF8OmYW0StZNRRlGb18YgmrGqiSIGV/sm0zP51hQjkVySmNVvVA\n9E2P8GO7FutJD7Xe2lQyfxvJmU/fyXhw168RUUJrAKErvzP+8/GHnTSW2urvW6Se\nTduyyiHFJqNPt78igJeXdTaYIwKBgQDHWZTXTe0kWtsWTKB8cTIcguskVJ+LHeJP\nNBnbCOxjmYi6SxF0G+gUB/zZ74+DgJSezfe59AY0g2Bl2oOuSN8S5ABQABNi/zkL\nt/AYfUdNKsyR2OlGL21HTmpY14rDanKVIi41FsvDqn7PH5EYk/4ihJ795wN5tbch\ni4kYqZQQKQKBgCQNYwrMtT2P1Z6E73zJSt8uLWOyucwSc93oZPLekvvyXkyv6x3b\n4v8aYq+wGPN2WsKLwG4JgIInHA0xTDfHFeY0ohHxXQWpSWrlQcrw+b35eK98qiKv\nXNSaOKzQh5lURTjJLzy8zXQXOjyKHt7aKVMotEO/RanKfBUXQDF/u1B3AoGBALgr\n3+HGIbe7pLsGUiKF5ZkHrrwi3j8FfeZUqSp+JP6jgvkxj09o1NFky8qAk2MXcLcC\nbMLEWtM7KN0QsyVaN5VZRZyjZUXJq2dTKSNG4o+9Yb/A2Us5V8lP/dpUT+PYPUHg\nkTYE+H2tz3gFnuRJHbnAMq86NTDFnAoGwsMhMCR5AoGBAJnLIso4isTbjnCVdJbN\nCMwGAYoCMTN0laF76UAaes4iLcEQwMvdeoQA3Ns75u9u0XNNUAaCE+AIRjfeloBY\nSjaaeCrEBI8BfoOqJemtOu0jCID/ItcW4GqRhqSnJ536pGqxrXpjmWxNng0rvmHd\nfvWdLbbkCCYI8aKYU/a2lstO\n-----END PRIVATE KEY-----\n",
//     "client_email": "firebase-adminsdk-v0792@e-log-735d8.iam.gserviceaccount.com",
//     "client_id": "103067639679602861571",
//     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
//     "token_uri": "https://oauth2.googleapis.com/token",
//     "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
//     "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-v0792%40e-log-735d8.iam.gserviceaccount.com"
//   }

const config = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
};
module.exports = config;
