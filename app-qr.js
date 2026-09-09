(function initBackpackerAppQr(global) {
  "use strict";

  const APP_QR_URL = "https://app.backpackerapp.cc/";
  const QUIET_ZONE_MODULES = 4;
  const MATRIX_ROWS = Object.freeze([
    "11111110100110110010001111111",
    "10000010011000101100101000001",
    "10111010100010101111001011101",
    "10111010111000111011101011101",
    "10111010001101000001001011101",
    "10000010110001100101101000001",
    "11111110101010101010101111111",
    "00000000110001110010000000000",
    "11010011011001100010011101101",
    "10111100110001010110011010110",
    "01000010000010000101110111101",
    "10001001011011111010100111110",
    "01100110111110011000010011100",
    "00101001100101010100111001111",
    "01100111101100100000010011011",
    "11100000011100010001110010101",
    "10010010110010000001001101110",
    "01011001101010100011100010101",
    "10101010100010111011110110100",
    "10001100110011110000101000111",
    "11010110010000101111111111011",
    "00000000010000001011100011011",
    "11111110110001100001101010011",
    "10000010011101000101100010111",
    "10111010011100011010111111010",
    "10111010100010001100111101010",
    "10111010001011100111110010100",
    "10000010101001111100011101011",
    "11111110110101100000010110100",
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
