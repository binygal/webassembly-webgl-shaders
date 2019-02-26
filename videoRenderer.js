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
 * @param {ImageData} firstImageData
 * @param {ImageData} secondImageData
 * @param {CanvasRenderingContext2D} context
 */
export function renderFrame(firstImageData, secondImageData, context) {
  // console.log(firstImageData);

  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.putImageData(firstImageData, 0, 0);
  // Pass the imageData to the C++ code
  ccallArrays("blendTexturesSetup", null, ["array"], [], {
    heapIn: "HEAPU8"
  });
  ccallArrays("blendTexturesLoadMain", null, ["array"], [firstImageData.data], {
    heapIn: "HEAPU8"
  });
  ccallArrays(
    "blendTexturesLoadSecondary",
    null,
    ["array"],
    [secondImageData.data],
    {
      heapIn: "HEAPU8"
    }
  );
  ccallArrays("blendTexturesRun", null, ["array"], [firstImageData.data], {
    heapIn: "HEAPU8"
  });
  ccallArrays("detectingEdgesSetup", null, ["array"], [], {
    heapIn: "HEAPU8"
  });
  ccallArrays(
    "detectingEdgesLoadMain",
    null,
    ["array"],
    [firstImageData.data],
    {
      heapIn: "HEAPU8"
    }
  );
  ccallArrays("detectingEdgesRun", null, ["array"], [firstImageData.data], {
    heapIn: "HEAPU8"
  });
}
