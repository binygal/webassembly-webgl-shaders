"use strict";

window.addEventListener("wasmLoaded", () => {
  console.log("wasmLoaded");

  let previewCanvasContext;
  let secondaryCanvasContext;

  const canvasContainer = document.getElementById("canvasContainer");
  const canvasContainer1 = document.getElementById("canvasContainer1");
  const fileInput = document.getElementById("fileInput");
  const fileInput2 = document.getElementById("fileInput2");
  const convert = document.getElementById("convert");

  const createCanvas = (id, index, width, height) => {
    const canvas = document.createElement("canvas");
    canvas.id = id;
    canvas.width = width;
    canvas.height = height;
    canvasContainer.appendChild(canvas);
    const context = canvas.getContext("webgl2");

    const idBuffer = Module._malloc(id.length + 1);
    stringToUTF8(id, idBuffer, id.length + 1);
    Module.ccall(
      "createContext",
      null,
      ["number", "number", "number", "number"],
      [width, height, idBuffer, index]
    );
  };

  const loadImage1 = src => {
    Module.ccall("clearContexts", null, null, null);

    const img = new Image();
    img.addEventListener("load", () => {
      const canvas = document.createElement("canvas");
      canvas.id = "previewCanvas";
      canvas.height = img.height;
      canvas.width = img.width;

      canvasContainer.innerHTML = "";
      previewCanvasContext = canvas.getContext("2d");
      previewCanvasContext.drawImage(img, 0, 0);
      canvasContainer.appendChild(canvas);

      createCanvas("textureLoad", 0, img.width, img.height);
      createCanvas("edgeDetect", 1, img.width, img.height);
    });

    img.src = src;
  };

  const loadImage2 = src => {
    const img = new Image();
    img.addEventListener("load", () => {
      const secondaryCanvas = document.createElement("canvas");
      secondaryCanvas.id = "secondaryCanvas";
      secondaryCanvas.height = img.height;
      secondaryCanvas.width = img.width;

      canvasContainer1.innerHTML = "";
      secondaryCanvasContext = secondaryCanvas.getContext("2d");
      secondaryCanvasContext.drawImage(img, 0, 0);
      canvasContainer1.appendChild(secondaryCanvas);
    });

    img.src = src;
  };

  // Default image
  loadImage1("image.png");
  loadImage2("image.png");

  // File input
  fileInput.addEventListener("change", event =>
    loadImage1(URL.createObjectURL(event.target.files[0]))
  );
  fileInput2.addEventListener("change", event =>
    loadImage2(URL.createObjectURL(event.target.files[0]))
  );

  convert.addEventListener("click", () => {
    const previewCanvas = document.getElementById("previewCanvas");
    // Get imageData from the image
    const image1Data = previewCanvasContext.getImageData(
      0,
      0,
      previewCanvas.width,
      previewCanvas.height
    ).data;
    const image2Data = secondaryCanvasContext.getImageData(
      0,
      0,
      previewCanvas.width,
      previewCanvas.height
    ).data;

    // Pass the imageData to the C++ code
    ccallArrays("blendTexturesSetup", null, ["array"], [image1Data], {
      heapIn: "HEAPU8"
    });
    ccallArrays("blendTexturesLoadMain", null, ["array"], [image2Data], {
      heapIn: "HEAPU8"
    });
    ccallArrays("blendTexturesLoadSecondary", null, ["array"], [image1Data], {
      heapIn: "HEAPU8"
    });
    ccallArrays("blendTexturesRun", null, ["array"], [image1Data], {
      heapIn: "HEAPU8"
    });
    ccallArrays("detectingEdgesSetup", null, ["array"], [image1Data], {
      heapIn: "HEAPU8"
    });
    ccallArrays("detectingEdgesLoadMain", null, ["array"], [image1Data], {
      heapIn: "HEAPU8"
    });
    ccallArrays("detectingEdgesRun", null, ["array"], [image1Data], {
      heapIn: "HEAPU8"
    });
  });
});
