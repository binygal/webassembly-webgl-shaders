/**
 *
 * @param {HTMLVideoElement} video
 * @param {CanvasRenderingContext2D} renderContext
 * @param {function} callback
 */
function frame(video, renderContext, callback) {
  renderContext.drawImage(
    video,
    0,
    0,
    renderContext.canvas.width,
    renderContext.canvas.height
  );
  callback(
    renderContext.getImageData(
      0,
      0,
      renderContext.canvas.width,
      renderContext.canvas.height
    )
  );
  if (video.ended) {
    console.warn("ended");
    return;
  }
  requestAnimationFrame(() => frame(video, renderContext, callback));
}

export default function createVideoStream(file, frameCallback) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const videoElement = document.createElement("video");
    videoElement.setAttribute("src", url);
    createVideoStreamFromElement(videoElement, frameCallback);
    resolve();
  });
}

/**
 *
 * @param {HTMLVideoElement} videoElement
 * @param {function} frameCallback
 */
export function createVideoStreamFromElement(videoElement, frameCallback) {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");

  requestAnimationFrame(() => frame(videoElement, ctx, frameCallback));
  if (videoElement.readyState === 4) {
    console.log("ready to play");

    videoElement.play();
  } else {
    videoElement.onloadeddata = () => {
      console.log("loaded");

      videoElement.play();
    };
  }
}
