const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3000",
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      ...(process.env.CHROMIUM_PATH
        ? { executablePath: process.env.CHROMIUM_PATH }
        : {}),
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--no-zygote",
      ],
    },
  },
  webServer: {
    command: "python3 -m http.server 3000 --bind 0.0.0.0",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
  },
});
