const path = require("path");
const { ENV } = require("../config");

const home = (req, res) => {
  return res.sendFile(path.join(`${__dirname}/../views/index.html`), {
    headers: { "Content-Type": "text/html", "X-Env": `${ENV}` },
  });
};
module.exports = {
  getHome: home,
};
