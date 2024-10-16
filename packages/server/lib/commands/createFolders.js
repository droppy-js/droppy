import filetree from "../services/filetree.js";
import log from "../services/log.js";
import utils from "../services/utils.js";

export default {
  handler: async ({ validatePaths, sid, config, msg, ws, vId, sendError }) => {
    if (config.readOnly) {
      return sendError(sid, vId, "Files are read-only");
    }

    if (!validatePaths(msg.data.folders, msg.type, ws, sid, vId)) {
      return;
    }

    await Promise.all(
      msg.data.folders.map((folder) => {
        return new Promise((resolve) => {
          filetree.mkdir(utils.addFilesPath(folder), (err) => {
            if (err) {
              log.error(ws, null, err);
            }
            resolve();
          });
        });
      })
    );
  },
};
