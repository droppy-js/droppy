export default {
  handler: async ({ sid, vId, setView }) => {
    setView(sid, vId, null);
  },
};
