/**
 * Utility method to create an XML document object with a jQuery-like
 * interface for node manipulation.
 */

"use strict";

import { load } from "cheerio";

export default function loadXml(text) {
  return load(text, {
    xmlMode: true,
  });
}
