const env = require("./src/config/env.js");
const connectDB = require("./src/config/db");
const app = require("./src/app");

const start = async () => {
  await connectDB();
  app.listen(env.port, () => {
    console.log(`Server running at http://localhost:${env.port}`);
  });
};

start().catch((err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});