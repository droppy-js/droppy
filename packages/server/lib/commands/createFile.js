import filetree from "../services/filetree.js";

export default {
  handler: async ({ validatePaths, sid, config, msg, ws, vId, sendError }) => {
    if (config.readOnly) {
      return sendError(sid, vId, "Files are read-only");
    }
    if (!validatePaths(msg.data, msg.type, ws, sid, vId)) {
      return;
    }
    filetree.mk(msg.data, (err) => {
      if (err) sendError(sid, vId, `Error creating file: ${err.message}`);
    });
  },
};
