import filetree from "../services/filetree.js";
import log from "../services/log.js";

export default {
  handler: async ({ validatePaths, sid, config, msg, ws, vId, sendError }) => {
    if (config.readOnly) {
      log.info(ws, null, `Prevent deleting read-only file: ${msg.data}`);
      return sendError(sid, vId, "Files are read-only");
    }

    if (!validatePaths(msg.data, msg.type, ws, sid, vId)) {
      return;
    }
    log.info(ws, null, `Deleting: ${msg.data}`);

    try {
      await filetree.del(msg.data);
    } catch (err) {
      log.info(ws, null, `Error deleting file: ${msg.data}`);
      log.error(err);
      return sendError(sid, vId, "Error deleting file");
    }
  },
};
