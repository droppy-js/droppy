import { magenta } from "colorette";

import log from "../services/log.js";
import db from "../services/db.js";

export default {
  handler: async ({ priv, cookie, sid, msg, ws, sendUsers, sendError }) => {
    const name = msg.data.name;
    const pass = msg.data.pass;
    if (!priv) return;
    if (pass === "") {
      if (!db.get("users")[name]) {
        // TODO: warning?
        return;
      }
      if ((db.get("sessions")[cookie] || {}).username === name) {
        return sendError(sid, null, "Cannot delete yourself");
      }
      if (db.delUser(name)) {
        log.info(ws, null, "Deleted user: ", magenta(name));
      }
    } else {
      const isNew = !db.get("users")[name];
      db.addOrUpdateUser(name, pass, msg.data.priv || false);
      log.info(
        ws,
        null,
        `${isNew ? "Added" : "Updated"} user: `,
        magenta(name)
      );
    }
    sendUsers(sid);
  },
};
