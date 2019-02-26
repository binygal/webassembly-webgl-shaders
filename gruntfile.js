module.exports = grunt => {
  grunt.initConfig({
    uglify: {
      my_target: {
        options: {
          sourceMap: false,
          mangle: false
        },
        files: {
          "dist/appWASM.js": ["dist/appWASM.js"]
        }
      }
    },

    exec: {
      build:
        "echo Building... & emcc -o ./assets/appWASM.js ./dev/cpp/emscripten.cpp -O2 -s ALLOW_MEMORY_GROWTH=1 -s USE_WEBGL2=1 -s WASM=1 -s NO_EXIT_RUNTIME=1 -s EXTRA_EXPORTED_RUNTIME_METHODS=['ccall'] -std=c++1z"
    },

    watch: {
      cpp: {
        files: ["dev/cpp/*.cpp", "dev/cpp/*.h"],
        tasks: ["exec:build", "babel", "uglify"]
      }
    }
  });

  grunt.loadNpmTasks("grunt-contrib-watch");
  grunt.loadNpmTasks("grunt-contrib-uglify");
  grunt.loadNpmTasks("grunt-exec");

  grunt.registerTask("default", ["watch"]);
};
