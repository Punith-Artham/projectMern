require('./config/env');
const app = require('./app');
const connectDB = require('./config/db');
const env = require('./config/env');

const start = async () => {
  try {
    await connectDB();
    app.listen(env.PORT, () => {
      console.log(`API running on http://localhost:${env.PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

start();
