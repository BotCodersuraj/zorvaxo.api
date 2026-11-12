
module.exports = (req, res) => {
  res.status(200).json({
    name: "OverMC API",
    status: "running",
    version: "1.0.0",
    endpoints: {
      status: "/api/status"
    }
  });
};
