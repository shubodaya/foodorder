export function notFoundHandler(_req, res) {
  res.status(404).json({ message: "Route not found" });
}

export function errorHandler(error, _req, res, _next) {
  const status = error.status || 500;
  res.status(status).json({ message: error.message || "Server error" });
}
