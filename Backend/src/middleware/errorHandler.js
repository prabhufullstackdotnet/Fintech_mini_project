
function errorHandler(err, req, res, next) {
  console.error(err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    success: false,
    message: "An unexpected server error occurred.",
  });
}

module.exports = errorHandler;
