import fs from "fs";
import escRe from "escape-string-regexp";

import filetree from "../services/filetree.js";
import log from "../services/log.js";
import utils from "../services/utils.js";

export default {
  handler: async ({ validatePaths, sid, config, msg, ws, vId, sendError }) => {
    const src = msg.data.src;
    const dst = msg.data.dst;
    const type = msg.data.type;

    log.info(ws, null, `Clipboard ${type}: ${src} -> ${dst}`);

    if (config.readOnly) {
      return sendError(sid, vId, "Files are read-only");
    }

    if (!validatePaths([src, dst], msg.type, ws, sid, vId)) {
      return;
    }

    if (new RegExp(`^${escRe(msg.data.src)}/`).test(msg.data.dst)) {
      return sendError(sid, vId, "Can't copy directory into itself");
    }

    fs.stat(utils.addFilesPath(msg.data.dst), async (err, stats) => {
      if ((!err && stats) || msg.data.src === msg.data.dst) {
        utils.getNewPath(utils.addFilesPath(msg.data.dst), (newDst) => {
          filetree.clipboard(
            msg.data.src,
            utils.removeFilesPath(newDst),
            msg.data.type
          );
        });
      } else {
        filetree.clipboard(msg.data.src, msg.data.dst, msg.data.type);
      }
    });
  },
};
