const appJson = require("./app.json");

const config = appJson.expo;

module.exports = {
  expo: {
    ...config,
    android: {
      ...config.android,
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_PLACES_API_KEY || "",
        },
      },
    },
  },
};
