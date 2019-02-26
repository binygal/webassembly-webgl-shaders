import { Subject, zip } from "rxjs";

import { createVideoStreamFromElement } from "./createVideoStream";
import {
  clearContex,
  createContext,
  renderFrame,
  setup
} from "./videoRenderer";

window.addEventListener("wasmLoaded", () => {
  console.log("wasmLoaded");

  let previewCanvasContext;
  let secondaryCanvasContext;

  const canvasContainer = document.getElementById("canvasContainer");
  const canvasContainer1 = document.getElementById("canvasContainer1");
  const fileInput = document.getElementById("fileInput");
  const fileInput2 = document.getElementById("fileInput2");
  /** @type {HTMLVideoElement} */
  const firstVideoElement = document.getElementById("firstVideo");
  /** @type {HTMLVideoElement} */
  const secondVideoElement = document.getElementById("secondVideo");
  const convert = document.getElementById("convert");

  firstVideoElement.addEventListener("loadeddata", () => {
    const canvas = document.createElement("canvas");
    canvas.id = "previewCanvas";
    canvas.height = firstVideoElement.clientHeight;
    canvas.width = firstVideoElement.clientWidth;

    secondVideoElement.style.maxWidth = `${firstVideoElement.clientWidth}px`;
    secondVideoElement.style.maxHeight = `${firstVideoElement.clientHeight}px`;
    previewCanvasContext = canvas.getContext("2d");
    previewCanvasContext.drawImage(firstVideoElement, 0, 0);
  });

  secondVideoElement.addEventListener("loadeddata", () => {
    const canvas = document.createElement("canvas");
    canvas.id = "previewCanvas";
    canvas.height = firstVideoElement.clientHeight;
    canvas.width = firstVideoElement.clientWidth;

    secondaryCanvasContext = canvas.getContext("2d");
    secondaryCanvasContext.drawImage(secondVideoElement, 0, 0);
  });

  function createCanvases(size) {
    canvasContainer.childNodes.forEach(c => canvasContainer.removeChild(c));
    const textureLoadCanvas = document.createElement("canvas");
    textureLoadCanvas.id = "textureLoad";
    textureLoadCanvas.width = 800;
    textureLoadCanvas.height = 600;
    canvasContainer.appendChild(textureLoadCanvas);

    const edgeDetectCanvas = document.createElement("canvas");
    edgeDetectCanvas.id = "edgeDetect";
    edgeDetectCanvas.width = 800;
    edgeDetectCanvas.height = 600;
    canvasContainer.appendChild(edgeDetectCanvas);

    createContext(textureLoadCanvas, 0);
    createContext(edgeDetectCanvas, 1);
  }

  function loadFirstVideo(src) {
    clearContex();
    firstVideoElement.src = src;
    createCanvases({
      width: firstVideoElement.clientWidth,
      height: firstVideoElement.clientHeight
    });
  }

  function loadSecondVideo(src) {
    secondVideoElement.src = src;
  }

  loadFirstVideo("./dog.mp4");
  loadSecondVideo("./race.mp4");

  // File input
  fileInput.addEventListener("change", event =>
    loadFirstVideo(URL.createObjectURL(event.target.files[0]))
  );
  fileInput2.addEventListener("change", event =>
    loadSecondVideo(URL.createObjectURL(event.target.files[0]))
  );

  convert.addEventListener("click", () => {
    const firstVideoSubject = new Subject();
    const secondVideoSubject = new Subject();

    setup();
    createVideoStreamFromElement(firstVideoElement, imageData => {
      firstVideoSubject.next(imageData);
    });
    createVideoStreamFromElement(secondVideoElement, imageData => {
      secondVideoSubject.next(imageData);
    });

    zip(firstVideoSubject, secondVideoSubject).subscribe(images =>
      renderFrame(images[0], images[1])
    );
  });
});
