import { ccallArrays } from "./wasm-arrays";

/**
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} index
 */
export function createContext(canvas, index) {
  const idBuffer = Module._malloc(canvas.id.length + 1);
  stringToUTF8(canvas.id, idBuffer, canvas.id.length + 1);
  Module.ccall(
    "createContext",
    null,
    ["number", "number", "number", "number"],
    [canvas.width, canvas.height, idBuffer, index]
  );
}

export function clearContex() {
  Module.ccall("clearContexts", null, null, null);
}

export function setup() {
  ccallArrays("blendTexturesSetup", null, ["array"], [], {
    heapIn: "HEAPU8"
  });
  ccallArrays("detectingEdgesSetup", null, ["array"], [], {
    heapIn: "HEAPU8"
  });
}

/**
 *
 * @param {Uint8Array} firstImageData
 * @param {ImageData} secondImageData
 */
export function renderFrame(firstImageData, secondImageData) {
  // Pass the imageData to the C++ code
  ccallArrays("blendTexturesSetup", null, ["array"], [], {
    heapIn: "HEAPU8"
  });
  ccallArrays("blendTexturesLoadMain", null, ["array"], [firstImageData], {
    heapIn: "HEAPU8"
  });
  ccallArrays(
    "blendTexturesLoadSecondary",
    null,
    ["array"],
    [secondImageData],
    {
      heapIn: "HEAPU8"
    }
  );
  ccallArrays("blendTexturesRun", null, ["array"], [firstImageData], {
    heapIn: "HEAPU8"
  });
}
