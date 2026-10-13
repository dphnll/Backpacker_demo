(function initBackpackerAppQr(global) {
  "use strict";

  const APP_QR_URL = "https://app.clavelo.cc/";
  const QUIET_ZONE_MODULES = 4;
  const MATRIX_ROWS = Object.freeze([
    "1111111011000111101111111",
    "1000001000100000001000001",
    "1011101011011010101011101",
    "1011101010001010001011101",
    "1011101010111101101011101",
    "1000001010101110101000001",
    "1111111010101010101111111",
    "0000000000101101100000000",
    "0011111100100001110111101",
    "0000000100000100100010000",
    "1101011011000111010010111",
    "1001110010110011100000111",
    "0011011000101010010110101",
    "1001110011101010101011100",
    "0101011100101001100100110",
    "0111010010111011010010110",
    "1110101111100101111111010",
    "0000000001001100100010010",
    "1111111010111011101011000",
    "1000001011100111100010011",
    "1011101010001011111111011",
    "1011101010100110010101111",
    "1011101010001000101011101",
    "1000001001101110001111001",
    "1111111000111011001011111",
  ]);

  function buildPathData() {
    const commands = [];
    MATRIX_ROWS.forEach((row, y) => {
      let x = 0;
      while (x < row.length) {
        if (row[x] !== "1") {
          x += 1;
          continue;
        }
        const start = x;
        while (x < row.length && row[x] === "1") x += 1;
        const width = x - start;
        commands.push(`M${start + QUIET_ZONE_MODULES} ${y + QUIET_ZONE_MODULES}h${width}v1h-${width}z`);
      }
    });
    return commands.join("");
  }

  function render(target) {
    if (!target?.ownerDocument) throw new Error("app_qr_target_required");
    const documentLike = target.ownerDocument;
    const svg = documentLike.createElementNS("http://www.w3.org/2000/svg", "svg");
    const size = MATRIX_ROWS.length + (QUIET_ZONE_MODULES * 2);
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("shape-rendering", "crispEdges");

    const background = documentLike.createElementNS("http://www.w3.org/2000/svg", "rect");
    background.setAttribute("width", String(size));
    background.setAttribute("height", String(size));
    background.setAttribute("fill", "#ffffff");

    const modules = documentLike.createElementNS("http://www.w3.org/2000/svg", "path");
    modules.setAttribute("d", buildPathData());
    modules.setAttribute("fill", "#111111");

    svg.append(background, modules);
    target.replaceChildren(svg);
    return svg;
  }

  const api = Object.freeze({
    url: APP_QR_URL,
    matrixRows: MATRIX_ROWS,
    render,
  });

  if (global) global.BackpackerAppQr = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : null);
