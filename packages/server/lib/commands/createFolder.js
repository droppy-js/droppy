import filetree from "../services/filetree.js";
import log from "../services/log.js";

export default {
  handler: async ({ validatePaths, sid, config, msg, ws, vId, sendError }) => {
    if (config.readOnly) {
      return sendError(sid, vId, "Files are read-only");
    }
    if (!validatePaths(msg.data, msg.type, ws, sid, vId)) {
      return;
    }

    try {
      await filetree.mkdir(msg.data);
    } catch (err) {
      log.error(ws, null, err);
      sendError(sid, vId, `Error creating folder: ${err.message}`);
    }
  },
};
