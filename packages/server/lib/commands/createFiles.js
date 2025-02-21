import path from "path";

import filetree from "../services/filetree.js";
import utils from "../services/utils.js";
import log from "../services/log.js";

export default {
  handler: async ({ validatePaths, sid, config, msg, ws, vId, sendError }) => {
    if (config.readOnly) {
      return sendError(sid, vId, "Files are read-only");
    }
    if (!validatePaths(msg.data.files, msg.type, ws, sid, vId)) {
      return;
    }

    for (const file of msg.data.files) {
      try {
        await filetree.mkdir(utils.addFilesPath(path.dirname(file)));
        await filetree.mk(utils.addFilesPath(file));
      } catch (err) {
        log.error(ws, null, err);
        sendError(sid, vId, `Error creating file`);
      }
    }
  },
};
