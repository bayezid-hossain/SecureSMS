module.exports = ({ config }) => {
  return {
    ...config,
    extra: {
      ...config.extra,
      webClientId: process.env.CLIENT_ID,
    },
  };
};
