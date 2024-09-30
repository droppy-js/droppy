"use strict";

import copyAttributes from "./utils/copy-attributes.js";
import loadXml from "./utils/load-xml.js";
import removeAttributes from "./utils/remove-attributes.js";
import setAttributes from "./utils/set-attributes.js";
import svgToSymbol from "./utils/svg-to-symbol.js";

const SELECTOR_SVG = "svg";
const SELECTOR_DEFS = "defs";

const TEMPLATE_SVG = "<svg><defs/></svg>";
const TEMPLATE_DOCTYPE =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" ' +
  '"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">';

const DEFAULT_OPTIONS = {
  cleanDefs: false,
  cleanSymbols: false,
  inline: false,
  svgAttrs: false,
  symbolAttrs: false,
  copyAttrs: false,
  renameDefs: false,
};

export default function svgstore(options) {
  const svgstoreOptions = Object.assign({}, DEFAULT_OPTIONS, options);

  // <svg>
  const parent = loadXml(TEMPLATE_SVG);
  const parentSvg = parent(SELECTOR_SVG);
  const parentDefs = parent(SELECTOR_DEFS);

  return {
    element: parent,

    add(id, file, options) {
      const child = loadXml(file);
      const addOptions = Object.assign({}, svgstoreOptions, options);

      // <defs>
      const childDefs = child(SELECTOR_DEFS);

      removeAttributes(childDefs, addOptions.cleanDefs);

      /* rename defs ids */
      if (addOptions.renameDefs) {
        childDefs.children().each((_, elem) => {
          const $elem = child(elem);
          const oldDefId = $elem.attr("id");
          const newDefId = `${id}_${oldDefId}`;
          $elem.attr("id", newDefId);

          /* process use tags */
          child("use").each((_, use) => {
            const $use = child(use);

            const hrefLink = `#${oldDefId}`;
            const checkableProperties = ["xlink:href", "href"];
            let foundProperty;
            for (let j = 0; j < checkableProperties.length; j++) {
              const currentProperty = checkableProperties[j];
              if ($use.prop(currentProperty) === hrefLink) {
                foundProperty = currentProperty;
                break;
              }
            }
            if (!foundProperty) {
              return;
            }
            $use.attr(foundProperty, `#${newDefId}`);
          });

          /* process fill attributes */
          child(`[fill="url(#${oldDefId})"]`).each((_, use) => {
            child(use).attr("fill", `url(#${newDefId})`);
          });
        });
      }

      parentDefs.append(childDefs.contents());
      childDefs.remove();

      // <symbol>
      const childSvg = child(SELECTOR_SVG);
      const childSymbol = svgToSymbol(id, child, addOptions);

      removeAttributes(childSymbol, addOptions.cleanSymbols);
      copyAttributes(childSymbol, childSvg, addOptions.copyAttrs);
      setAttributes(childSymbol, addOptions.symbolAttrs);
      parentSvg.append(childSymbol);

      return this;
    },

    toString(options) {
      // Create a clone so we don't modify the parent document.
      const clone = loadXml(parent.xml());
      const toStringOptions = Object.assign({}, svgstoreOptions, options);

      // <svg>
      const svg = clone(SELECTOR_SVG);

      setAttributes(svg, toStringOptions.svgAttrs);

      // output inline
      if (toStringOptions.inline) {
        return clone.xml();
      }

      // output standalone
      svg.attr("xmlns", (val) => {
        return val || "http://www.w3.org/2000/svg";
      });

      svg.attr("xmlns:xlink", (val) => {
        return val || "http://www.w3.org/1999/xlink";
      });

      return TEMPLATE_DOCTYPE + clone.xml();
    },
  };
}
