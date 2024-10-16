export default {
  handler: async ({ priv, sid, config, sendUsers }) => {
    if (priv && !config.public) {
      sendUsers(sid);
    }
  },
};
