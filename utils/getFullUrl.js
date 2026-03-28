// utils/getFullUrl.js
const getFullUrl = (req, filePath) => {
  const protocol = req.protocol; // http or https from request
  const host = req.get("host"); // localhost:4000 or your domain
  console.log('protocol',protocol)
  console.log('host',host)
  console.log('filePath',filePath)
  return `${protocol}://${host}${filePath}`;
};

console.log('getFullUrl',getFullUrl)

module.exports = getFullUrl;
