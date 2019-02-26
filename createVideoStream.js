import { size as globalSize } from "./globals";

/**
 *
 * @param {HTMLVideoElement} video
 * @param {WebGLRenderingContext} renderContext
 * @param {function} callback
 */
function frame(video, renderContext, callback) {
  const tex = renderContext.createTexture();
  renderContext.bindTexture(renderContext.TEXTURE_2D, tex);
  const fbo = renderContext.createFramebuffer();
  renderContext.bindFramebuffer(renderContext.FRAMEBUFFER, fbo);
  renderContext.viewport(0, 0, globalSize.width, globalSize.height);
  renderContext.framebufferTexture2D(
    renderContext.FRAMEBUFFER,
    renderContext.COLOR_ATTACHMENT0,
    renderContext.TEXTURE_2D,
    tex,
    0
  );
  renderContext.texImage2D(
    renderContext.TEXTURE_2D,
    0,
    renderContext.RGBA,
    renderContext.RGBA,
    renderContext.UNSIGNED_BYTE,
    video
  );
  const typedArray = new Uint8Array(globalSize.width * globalSize.height * 4);
  renderContext.readPixels(
    0,
    0,
    globalSize.width,
    globalSize.height,
    renderContext.RGBA,
    renderContext.UNSIGNED_BYTE,
    typedArray
  );
  callback(typedArray);
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
  canvas.width = globalSize.width;
  canvas.height = globalSize.height;
  const ctx = canvas.getContext("webgl");

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
