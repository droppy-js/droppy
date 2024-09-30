/**
 * Utility method to create an XML document object with a jQuery-like
 * interface for node manipulation.
 */

"use strict";

const cheerio = require("cheerio");

function loadXml(text) {
  return cheerio.load(text, {
    xmlMode: true,
  });
}

module.exports = loadXml;
