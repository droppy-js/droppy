import filetree from "../services/filetree.js";
import log from "../services/log.js";

export default {
  handler: async ({
    validatePaths,
    sendObj,
    sid,
    config,
    msg,
    ws,
    vId,
    sendError,
  }) => {
    if (config.readOnly) {
      log.info(ws, null, `Prevented saving read-only file: ${msg.data.to}`);
      return sendError(sid, vId, "Files are read-only");
    }

    if (!validatePaths(msg.data.to, msg.type, ws, sid, vId)) {
      return;
    }

    log.info(ws, null, `Saving: ${msg.data.to}`);

    filetree.save(msg.data.to, msg.data.value, (err) => {
      if (err) {
        sendError(sid, vId, `Error saving: ${err.message}`);
        log.error(err);
      } else sendObj(sid, { type: "SAVE_STATUS", vId, status: err ? 1 : 0 });
    });
  },
};
