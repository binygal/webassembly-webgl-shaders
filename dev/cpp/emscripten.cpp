#include <emscripten.h>
#include <string>
#include <GLES2/gl2.h>
#include <EGL/egl.h>
extern "C" {
    #include "html5.h"
}
#include "Context.cpp"

Context* contexts[2];

int main(int argc, char const *argv[]) {
    printf("[WASM] Loaded\n");

    EM_ASM(
        if (typeof window!="undefined") {
            window.dispatchEvent(new CustomEvent("wasmLoaded"))
        } else {
            global.onWASMLoaded && global.onWASMLoaded()
        }
    );

    return 0;
}


extern "C" {

    EMSCRIPTEN_KEEPALIVE
    void clearContexts (void) {
        if (contexts[0]) delete contexts[0];
        if (contexts[1]) delete contexts[1];
    }

    EMSCRIPTEN_KEEPALIVE
    void createContext (int width, int height, char * id, int index) {
        contexts[index] = new Context(width, height, id);
        free(id);
    }

    EMSCRIPTEN_KEEPALIVE
    void blendTexturesSetup () {
        printf("[WASM] Blending Textures setup \n");

        contexts[0]->setup();
    }

    EMSCRIPTEN_KEEPALIVE
    void blendTexturesLoadMain(uint8_t *buf, int bufSize) {
        printf("[WASM] Blending Textures load main \n");

        contexts[0]->setupMainTexture(buf);
        free(buf);
    }

    EMSCRIPTEN_KEEPALIVE
    void blendTexturesLoadSecondary(uint8_t *buf, int bufSize) {
        printf("[WASM] Blending Textures load secondary \n");

        contexts[0]->setupSecondaryTexture(buf);
        free(buf);
    }

    EMSCRIPTEN_KEEPALIVE
    void blendTexturesRun () {
        printf("[WASM] Blending Textures run \n");

        contexts[0]->run();
    }

    EMSCRIPTEN_KEEPALIVE
    void detectingEdgesSetup () {
        printf("[WASM] Detecting Edges setup \n");

        contexts[1]->setup();
    }

    EMSCRIPTEN_KEEPALIVE
    void detectingEdgesLoadMain(uint8_t *buf, int bufSize) {
        printf("[WASM] Detecting Edges load main \n");

        contexts[1]->setupMainTexture(buf);
        free(buf);
    }

    EMSCRIPTEN_KEEPALIVE
    void detectingEdgesRun () {
        printf("[WASM] Detecting Edges run \n");

        contexts[1]->run();
    }
}