module.exports = {
  apps: [
    {
      name: "xcasper-api",
      script: "./artifacts/api-server/dist/index.mjs",
      interpreter: "node",
      interpreter_args: "--enable-source-maps",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        API_KEY: "asdfghjklm.",
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: "production",
        API_KEY: "asdfghjklm.",
        PORT: 3001,
      },
      error_file: "./logs/api-error.log",
      out_file: "./logs/api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
    },
  ],
};
