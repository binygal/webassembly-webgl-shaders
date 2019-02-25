var Module = typeof Module !== "undefined" ? Module : {};
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}
Module["arguments"] = [];
Module["thisProgram"] = "./this.program";
Module["quit"] = function(status, toThrow) {
  throw toThrow;
};
Module["preRun"] = [];
Module["postRun"] = [];
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;
ENVIRONMENT_IS_WEB = typeof window === "object";
ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
ENVIRONMENT_IS_NODE =
  typeof process === "object" &&
  typeof require === "function" &&
  !ENVIRONMENT_IS_WEB &&
  !ENVIRONMENT_IS_WORKER;
ENVIRONMENT_IS_SHELL =
  !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
var scriptDirectory = "";
function locateFile(path) {
  if (Module["locateFile"]) {
    return Module["locateFile"](path, scriptDirectory);
  } else {
    return scriptDirectory + path;
  }
}
if (ENVIRONMENT_IS_NODE) {
  scriptDirectory = __dirname + "/";
  var nodeFS;
  var nodePath;
  Module["read"] = function shell_read(filename, binary) {
    var ret;
    if (!nodeFS) nodeFS = require("fs");
    if (!nodePath) nodePath = require("path");
    filename = nodePath["normalize"](filename);
    ret = nodeFS["readFileSync"](filename);
    return binary ? ret : ret.toString();
  };
  Module["readBinary"] = function readBinary(filename) {
    var ret = Module["read"](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };
  if (process["argv"].length > 1) {
    Module["thisProgram"] = process["argv"][1].replace(/\\/g, "/");
  }
  Module["arguments"] = process["argv"].slice(2);
  if (typeof module !== "undefined") {
    module["exports"] = Module;
  }
  process["on"]("uncaughtException", function(ex) {
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });
  process["on"]("unhandledRejection", abort);
  Module["quit"] = function(status) {
    process["exit"](status);
  };
  Module["inspect"] = function() {
    return "[Emscripten Module object]";
  };
} else if (ENVIRONMENT_IS_SHELL) {
  if (typeof read != "undefined") {
    Module["read"] = function shell_read(f) {
      return read(f);
    };
  }
  Module["readBinary"] = function readBinary(f) {
    var data;
    if (typeof readbuffer === "function") {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, "binary");
    assert(typeof data === "object");
    return data;
  };
  if (typeof scriptArgs != "undefined") {
    Module["arguments"] = scriptArgs;
  } else if (typeof arguments != "undefined") {
    Module["arguments"] = arguments;
  }
  if (typeof quit === "function") {
    Module["quit"] = function(status) {
      quit(status);
    };
  }
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WORKER) {
    scriptDirectory = self.location.href;
  } else if (document.currentScript) {
    scriptDirectory = document.currentScript.src;
  }
  if (scriptDirectory.indexOf("blob:") !== 0) {
    scriptDirectory = scriptDirectory.substr(
      0,
      scriptDirectory.lastIndexOf("/") + 1
    );
  } else {
    scriptDirectory = "";
  }
  Module["read"] = function shell_read(url) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, false);
    xhr.send(null);
    return xhr.responseText;
  };
  if (ENVIRONMENT_IS_WORKER) {
    Module["readBinary"] = function readBinary(url) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, false);
      xhr.responseType = "arraybuffer";
      xhr.send(null);
      return new Uint8Array(xhr.response);
    };
  }
  Module["readAsync"] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
        onload(xhr.response);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };
  Module["setWindowTitle"] = function(title) {
    document.title = title;
  };
} else {
}
var out =
  Module["print"] ||
  (typeof console !== "undefined"
    ? console.log.bind(console)
    : typeof print !== "undefined"
    ? print
    : null);
var err =
  Module["printErr"] ||
  (typeof printErr !== "undefined"
    ? printErr
    : (typeof console !== "undefined" && console.warn.bind(console)) || out);
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
moduleOverrides = undefined;
var STACK_ALIGN = 16;
function dynamicAlloc(size) {
  var ret = HEAP32[DYNAMICTOP_PTR >> 2];
  var end = (ret + size + 15) & -16;
  if (end <= _emscripten_get_heap_size()) {
    HEAP32[DYNAMICTOP_PTR >> 2] = end;
  } else {
    var success = _emscripten_resize_heap(end);
    if (!success) return 0;
  }
  return ret;
}
function getNativeTypeSize(type) {
  switch (type) {
    case "i1":
    case "i8":
      return 1;
    case "i16":
      return 2;
    case "i32":
      return 4;
    case "i64":
      return 8;
    case "float":
      return 4;
    case "double":
      return 8;
    default: {
      if (type[type.length - 1] === "*") {
        return 4;
      } else if (type[0] === "i") {
        var bits = parseInt(type.substr(1));
        assert(
          bits % 8 === 0,
          "getNativeTypeSize invalid bits " + bits + ", type " + type
        );
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}
function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    err(text);
  }
}
var asm2wasmImports = {
  "f64-rem": function(x, y) {
    return x % y;
  },
  debugger: function() {
    debugger;
  }
};
var jsCallStartIndex = 1;
var functionPointers = new Array(0);
var funcWrappers = {};
function dynCall(sig, ptr, args) {
  if (args && args.length) {
    return Module["dynCall_" + sig].apply(null, [ptr].concat(args));
  } else {
    return Module["dynCall_" + sig].call(null, ptr);
  }
}
var tempRet0 = 0;
var setTempRet0 = function(value) {
  tempRet0 = value;
};
var getTempRet0 = function() {
  return tempRet0;
};
if (typeof WebAssembly !== "object") {
  err("no native wasm support detected");
}
var wasmMemory;
var wasmTable;
var ABORT = false;
var EXITSTATUS = 0;
function assert(condition, text) {
  if (!condition) {
    abort("Assertion failed: " + text);
  }
}
function getCFunc(ident) {
  var func = Module["_" + ident];
  assert(
    func,
    "Cannot call unknown function " + ident + ", make sure it is exported"
  );
  return func;
}
function ccall(ident, returnType, argTypes, args, opts) {
  var toC = {
    string: function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) {
        var len = (str.length << 2) + 1;
        ret = stackAlloc(len);
        stringToUTF8(str, ret, len);
      }
      return ret;
    },
    array: function(arr) {
      var ret = stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    }
  };
  function convertReturnValue(ret) {
    if (returnType === "string") return UTF8ToString(ret);
    if (returnType === "boolean") return Boolean(ret);
    return ret;
  }
  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);
  ret = convertReturnValue(ret);
  if (stack !== 0) stackRestore(stack);
  return ret;
}
function setValue(ptr, value, type, noSafe) {
  type = type || "i8";
  if (type.charAt(type.length - 1) === "*") type = "i32";
  switch (type) {
    case "i1":
      HEAP8[ptr >> 0] = value;
      break;
    case "i8":
      HEAP8[ptr >> 0] = value;
      break;
    case "i16":
      HEAP16[ptr >> 1] = value;
      break;
    case "i32":
      HEAP32[ptr >> 2] = value;
      break;
    case "i64":
      (tempI64 = [
        value >>> 0,
        ((tempDouble = value),
        +Math_abs(tempDouble) >= 1
          ? tempDouble > 0
            ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) |
                0) >>>
              0
            : ~~+Math_ceil(
                (tempDouble - +(~~tempDouble >>> 0)) / 4294967296
              ) >>> 0
          : 0)
      ]),
        (HEAP32[ptr >> 2] = tempI64[0]),
        (HEAP32[(ptr + 4) >> 2] = tempI64[1]);
      break;
    case "float":
      HEAPF32[ptr >> 2] = value;
      break;
    case "double":
      HEAPF64[ptr >> 3] = value;
      break;
    default:
      abort("invalid type for setValue: " + type);
  }
}
var ALLOC_NONE = 3;
var UTF8Decoder =
  typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;
function UTF8ArrayToString(u8Array, idx, maxBytesToRead) {
  var endIdx = idx + maxBytesToRead;
  var endPtr = idx;
  while (u8Array[endPtr] && !(endPtr >= endIdx)) ++endPtr;
  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var str = "";
    while (idx < endPtr) {
      var u0 = u8Array[idx++];
      if (!(u0 & 128)) {
        str += String.fromCharCode(u0);
        continue;
      }
      var u1 = u8Array[idx++] & 63;
      if ((u0 & 224) == 192) {
        str += String.fromCharCode(((u0 & 31) << 6) | u1);
        continue;
      }
      var u2 = u8Array[idx++] & 63;
      if ((u0 & 240) == 224) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (u8Array[idx++] & 63);
      }
      if (u0 < 65536) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 65536;
        str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
      }
    }
  }
  return str;
}
function UTF8ToString(ptr, maxBytesToRead) {
  return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
}
function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) return 0;
  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1;
  for (var i = 0; i < str.length; ++i) {
    var u = str.charCodeAt(i);
    if (u >= 55296 && u <= 57343) {
      var u1 = str.charCodeAt(++i);
      u = (65536 + ((u & 1023) << 10)) | (u1 & 1023);
    }
    if (u <= 127) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 2047) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 192 | (u >> 6);
      outU8Array[outIdx++] = 128 | (u & 63);
    } else if (u <= 65535) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 224 | (u >> 12);
      outU8Array[outIdx++] = 128 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 128 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 240 | (u >> 18);
      outU8Array[outIdx++] = 128 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 128 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 128 | (u & 63);
    }
  }
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}
function stringToUTF8(str, outPtr, maxBytesToWrite) {
  return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
}
function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    var u = str.charCodeAt(i);
    if (u >= 55296 && u <= 57343)
      u = (65536 + ((u & 1023) << 10)) | (str.charCodeAt(++i) & 1023);
    if (u <= 127) ++len;
    else if (u <= 2047) len += 2;
    else if (u <= 65535) len += 3;
    else len += 4;
  }
  return len;
}
var UTF16Decoder =
  typeof TextDecoder !== "undefined" ? new TextDecoder("utf-16le") : undefined;
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}
function writeArrayToMemory(array, buffer) {
  HEAP8.set(array, buffer);
}
function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    HEAP8[buffer++ >> 0] = str.charCodeAt(i);
  }
  if (!dontAddNull) HEAP8[buffer >> 0] = 0;
}
function demangle(func) {
  return func;
}
function demangleAll(text) {
  var regex = /__Z[\w\d_]+/g;
  return text.replace(regex, function(x) {
    var y = demangle(x);
    return x === y ? x : y + " [" + x + "]";
  });
}
function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    try {
      throw new Error(0);
    } catch (e) {
      err = e;
    }
    if (!err.stack) {
      return "(no stack trace available)";
    }
  }
  return err.stack.toString();
}
var WASM_PAGE_SIZE = 65536;
function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}
var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
function updateGlobalBuffer(buf) {
  Module["buffer"] = buffer = buf;
}
function updateGlobalBufferViews() {
  Module["HEAP8"] = HEAP8 = new Int8Array(buffer);
  Module["HEAP16"] = HEAP16 = new Int16Array(buffer);
  Module["HEAP32"] = HEAP32 = new Int32Array(buffer);
  Module["HEAPU8"] = HEAPU8 = new Uint8Array(buffer);
  Module["HEAPU16"] = HEAPU16 = new Uint16Array(buffer);
  Module["HEAPU32"] = HEAPU32 = new Uint32Array(buffer);
  Module["HEAPF32"] = HEAPF32 = new Float32Array(buffer);
  Module["HEAPF64"] = HEAPF64 = new Float64Array(buffer);
}
var STACK_BASE = 8240,
  DYNAMIC_BASE = 5251120,
  DYNAMICTOP_PTR = 7984;
var TOTAL_STACK = 5242880;
var TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 16777216;
if (TOTAL_MEMORY < TOTAL_STACK)
  err(
    "TOTAL_MEMORY should be larger than TOTAL_STACK, was " +
      TOTAL_MEMORY +
      "! (TOTAL_STACK=" +
      TOTAL_STACK +
      ")"
  );
if (Module["buffer"]) {
  buffer = Module["buffer"];
} else {
  if (
    typeof WebAssembly === "object" &&
    typeof WebAssembly.Memory === "function"
  ) {
    wasmMemory = new WebAssembly.Memory({
      initial: TOTAL_MEMORY / WASM_PAGE_SIZE
    });
    buffer = wasmMemory.buffer;
  } else {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
  Module["buffer"] = buffer;
}
updateGlobalBufferViews();
HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;
function callRuntimeCallbacks(callbacks) {
  while (callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == "function") {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === "number") {
      if (callback.arg === undefined) {
        Module["dynCall_v"](func);
      } else {
        Module["dynCall_vi"](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}
var __ATPRERUN__ = [];
var __ATINIT__ = [];
var __ATMAIN__ = [];
var __ATEXIT__ = [];
var __ATPOSTRUN__ = [];
var runtimeInitialized = false;
var runtimeExited = false;
function preRun() {
  if (Module["preRun"]) {
    if (typeof Module["preRun"] == "function")
      Module["preRun"] = [Module["preRun"]];
    while (Module["preRun"].length) {
      addOnPreRun(Module["preRun"].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}
function ensureInitRuntime() {
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}
function preMain() {
  callRuntimeCallbacks(__ATMAIN__);
}
function exitRuntime() {
  runtimeExited = true;
}
function postRun() {
  if (Module["postRun"]) {
    if (typeof Module["postRun"] == "function")
      Module["postRun"] = [Module["postRun"]];
    while (Module["postRun"].length) {
      addOnPostRun(Module["postRun"].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}
function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}
function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}
var Math_abs = Math.abs;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_min = Math.min;
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null;
function addRunDependency(id) {
  runDependencies++;
  if (Module["monitorRunDependencies"]) {
    Module["monitorRunDependencies"](runDependencies);
  }
}
function removeRunDependency(id) {
  runDependencies--;
  if (Module["monitorRunDependencies"]) {
    Module["monitorRunDependencies"](runDependencies);
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback();
    }
  }
}
Module["preloadedImages"] = {};
Module["preloadedAudios"] = {};
var dataURIPrefix = "data:application/octet-stream;base64,";
function isDataURI(filename) {
  return String.prototype.startsWith
    ? filename.startsWith(dataURIPrefix)
    : filename.indexOf(dataURIPrefix) === 0;
}
var wasmBinaryFile = "appWASM.wasm";
if (!isDataURI(wasmBinaryFile)) {
  wasmBinaryFile = locateFile(wasmBinaryFile);
}
function getBinary() {
  try {
    if (Module["wasmBinary"]) {
      return new Uint8Array(Module["wasmBinary"]);
    }
    if (Module["readBinary"]) {
      return Module["readBinary"](wasmBinaryFile);
    } else {
      throw "both async and sync fetching of the wasm failed";
    }
  } catch (err) {
    abort(err);
  }
}
function getBinaryPromise() {
  if (
    !Module["wasmBinary"] &&
    (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) &&
    typeof fetch === "function"
  ) {
    return fetch(wasmBinaryFile, { credentials: "same-origin" })
      .then(function(response) {
        if (!response["ok"]) {
          throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
        }
        return response["arrayBuffer"]();
      })
      .catch(function() {
        return getBinary();
      });
  }
  return new Promise(function(resolve, reject) {
    resolve(getBinary());
  });
}
function createWasm(env) {
  var info = {
    env: env,
    global: { NaN: NaN, Infinity: Infinity },
    "global.Math": Math,
    asm2wasm: asm2wasmImports
  };
  function receiveInstance(instance, module) {
    var exports = instance.exports;
    Module["asm"] = exports;
    removeRunDependency("wasm-instantiate");
  }
  addRunDependency("wasm-instantiate");
  if (Module["instantiateWasm"]) {
    try {
      return Module["instantiateWasm"](info, receiveInstance);
    } catch (e) {
      err("Module.instantiateWasm callback failed with error: " + e);
      return false;
    }
  }
  function receiveInstantiatedSource(output) {
    receiveInstance(output["instance"]);
  }
  function instantiateArrayBuffer(receiver) {
    getBinaryPromise()
      .then(function(binary) {
        return WebAssembly.instantiate(binary, info);
      })
      .then(receiver, function(reason) {
        err("failed to asynchronously prepare wasm: " + reason);
        abort(reason);
      });
  }
  if (
    !Module["wasmBinary"] &&
    typeof WebAssembly.instantiateStreaming === "function" &&
    !isDataURI(wasmBinaryFile) &&
    typeof fetch === "function"
  ) {
    WebAssembly.instantiateStreaming(
      fetch(wasmBinaryFile, { credentials: "same-origin" }),
      info
    ).then(receiveInstantiatedSource, function(reason) {
      err("wasm streaming compile failed: " + reason);
      err("falling back to ArrayBuffer instantiation");
      instantiateArrayBuffer(receiveInstantiatedSource);
    });
  } else {
    instantiateArrayBuffer(receiveInstantiatedSource);
  }
  return {};
}
Module["asm"] = function(global, env, providedBuffer) {
  env["memory"] = wasmMemory;
  env["table"] = wasmTable = new WebAssembly.Table({
    initial: 34,
    maximum: 34,
    element: "anyfunc"
  });
  env["__memory_base"] = 1024;
  env["__table_base"] = 0;
  var exports = createWasm(env);
  return exports;
};
var ASM_CONSTS = [
  function() {
    if (typeof window != "undefined") {
      window.dispatchEvent(new CustomEvent("wasmLoaded"));
    } else {
      global.onWASMLoaded && global.onWASMLoaded();
    }
  }
];
function _emscripten_asm_const_i(code) {
  return ASM_CONSTS[code]();
}
__ATINIT__.push({
  func: function() {
    __GLOBAL__sub_I_emscripten_cpp();
  }
});
var tempDoublePtr = 8224;
function __ZSt18uncaught_exceptionv() {
  return !!__ZSt18uncaught_exceptionv.uncaught_exception;
}
function ___cxa_free_exception(ptr) {
  try {
    return _free(ptr);
  } catch (e) {}
}
var EXCEPTIONS = {
  last: 0,
  caught: [],
  infos: {},
  deAdjust: function(adjusted) {
    if (!adjusted || EXCEPTIONS.infos[adjusted]) return adjusted;
    for (var key in EXCEPTIONS.infos) {
      var ptr = +key;
      var adj = EXCEPTIONS.infos[ptr].adjusted;
      var len = adj.length;
      for (var i = 0; i < len; i++) {
        if (adj[i] === adjusted) {
          return ptr;
        }
      }
    }
    return adjusted;
  },
  addRef: function(ptr) {
    if (!ptr) return;
    var info = EXCEPTIONS.infos[ptr];
    info.refcount++;
  },
  decRef: function(ptr) {
    if (!ptr) return;
    var info = EXCEPTIONS.infos[ptr];
    assert(info.refcount > 0);
    info.refcount--;
    if (info.refcount === 0 && !info.rethrown) {
      if (info.destructor) {
        Module["dynCall_vi"](info.destructor, ptr);
      }
      delete EXCEPTIONS.infos[ptr];
      ___cxa_free_exception(ptr);
    }
  },
  clearRef: function(ptr) {
    if (!ptr) return;
    var info = EXCEPTIONS.infos[ptr];
    info.refcount = 0;
  }
};
function ___cxa_begin_catch(ptr) {
  var info = EXCEPTIONS.infos[ptr];
  if (info && !info.caught) {
    info.caught = true;
    __ZSt18uncaught_exceptionv.uncaught_exception--;
  }
  if (info) info.rethrown = false;
  EXCEPTIONS.caught.push(ptr);
  EXCEPTIONS.addRef(EXCEPTIONS.deAdjust(ptr));
  return ptr;
}
function ___resumeException(ptr) {
  if (!EXCEPTIONS.last) {
    EXCEPTIONS.last = ptr;
  }
  throw ptr;
}
function ___cxa_find_matching_catch() {
  var thrown = EXCEPTIONS.last;
  if (!thrown) {
    return (setTempRet0(0), 0) | 0;
  }
  var info = EXCEPTIONS.infos[thrown];
  var throwntype = info.type;
  if (!throwntype) {
    return (setTempRet0(0), thrown) | 0;
  }
  var typeArray = Array.prototype.slice.call(arguments);
  var pointer = Module["___cxa_is_pointer_type"](throwntype);
  if (!___cxa_find_matching_catch.buffer)
    ___cxa_find_matching_catch.buffer = _malloc(4);
  HEAP32[___cxa_find_matching_catch.buffer >> 2] = thrown;
  thrown = ___cxa_find_matching_catch.buffer;
  for (var i = 0; i < typeArray.length; i++) {
    if (
      typeArray[i] &&
      Module["___cxa_can_catch"](typeArray[i], throwntype, thrown)
    ) {
      thrown = HEAP32[thrown >> 2];
      info.adjusted.push(thrown);
      return (setTempRet0(typeArray[i]), thrown) | 0;
    }
  }
  thrown = HEAP32[thrown >> 2];
  return (setTempRet0(throwntype), thrown) | 0;
}
function ___gxx_personality_v0() {}
var SYSCALLS = {
  buffers: [null, [], []],
  printChar: function(stream, curr) {
    var buffer = SYSCALLS.buffers[stream];
    if (curr === 0 || curr === 10) {
      (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
      buffer.length = 0;
    } else {
      buffer.push(curr);
    }
  },
  varargs: 0,
  get: function(varargs) {
    SYSCALLS.varargs += 4;
    var ret = HEAP32[(SYSCALLS.varargs - 4) >> 2];
    return ret;
  },
  getStr: function() {
    var ret = UTF8ToString(SYSCALLS.get());
    return ret;
  },
  get64: function() {
    var low = SYSCALLS.get(),
      high = SYSCALLS.get();
    return low;
  },
  getZero: function() {
    SYSCALLS.get();
  }
};
function ___syscall140(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD(),
      offset_high = SYSCALLS.get(),
      offset_low = SYSCALLS.get(),
      result = SYSCALLS.get(),
      whence = SYSCALLS.get();
    var offset = offset_low;
    FS.llseek(stream, offset, whence);
    HEAP32[result >> 2] = stream.position;
    if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
    return 0;
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function flush_NO_FILESYSTEM() {
  var fflush = Module["_fflush"];
  if (fflush) fflush(0);
  var buffers = SYSCALLS.buffers;
  if (buffers[1].length) SYSCALLS.printChar(1, 10);
  if (buffers[2].length) SYSCALLS.printChar(2, 10);
}
function ___syscall146(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.get(),
      iov = SYSCALLS.get(),
      iovcnt = SYSCALLS.get();
    var ret = 0;
    for (var i = 0; i < iovcnt; i++) {
      var ptr = HEAP32[(iov + i * 8) >> 2];
      var len = HEAP32[(iov + (i * 8 + 4)) >> 2];
      for (var j = 0; j < len; j++) {
        SYSCALLS.printChar(stream, HEAPU8[ptr + j]);
      }
      ret += len;
    }
    return ret;
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall54(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    return 0;
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function ___syscall6(which, varargs) {
  SYSCALLS.varargs = varargs;
  try {
    var stream = SYSCALLS.getStreamFromFD();
    FS.close(stream);
    return 0;
  } catch (e) {
    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
}
function _abort() {
  Module["abort"]();
}
function _emscripten_get_heap_size() {
  return TOTAL_MEMORY;
}
function abortOnCannotGrowMemory(requestedSize) {
  abort("OOM");
}
function emscripten_realloc_buffer(size) {
  var PAGE_MULTIPLE = 65536;
  size = alignUp(size, PAGE_MULTIPLE);
  var old = Module["buffer"];
  var oldSize = old.byteLength;
  try {
    var result = wasmMemory.grow((size - oldSize) / 65536);
    if (result !== (-1 | 0)) {
      return (Module["buffer"] = wasmMemory.buffer);
    } else {
      return null;
    }
  } catch (e) {
    return null;
  }
}
function _emscripten_resize_heap(requestedSize) {
  var oldSize = _emscripten_get_heap_size();
  var PAGE_MULTIPLE = 65536;
  var LIMIT = 2147483648 - PAGE_MULTIPLE;
  if (requestedSize > LIMIT) {
    return false;
  }
  var MIN_TOTAL_MEMORY = 16777216;
  var newSize = Math.max(oldSize, MIN_TOTAL_MEMORY);
  while (newSize < requestedSize) {
    if (newSize <= 536870912) {
      newSize = alignUp(2 * newSize, PAGE_MULTIPLE);
    } else {
      newSize = Math.min(
        alignUp((3 * newSize + 2147483648) / 4, PAGE_MULTIPLE),
        LIMIT
      );
    }
  }
  var replacement = emscripten_realloc_buffer(newSize);
  if (!replacement || replacement.byteLength != newSize) {
    return false;
  }
  updateGlobalBuffer(replacement);
  updateGlobalBufferViews();
  TOTAL_MEMORY = newSize;
  HEAPU32[DYNAMICTOP_PTR >> 2] = requestedSize;
  return true;
}
var GL = {
  counter: 1,
  lastError: 0,
  buffers: [],
  mappedBuffers: {},
  programs: [],
  framebuffers: [],
  renderbuffers: [],
  textures: [],
  uniforms: [],
  shaders: [],
  vaos: [],
  contexts: {},
  currentContext: null,
  offscreenCanvases: {},
  timerQueriesEXT: [],
  queries: [],
  samplers: [],
  transformFeedbacks: [],
  syncs: [],
  programInfos: {},
  stringCache: {},
  stringiCache: {},
  unpackAlignment: 4,
  init: function() {
    GL.miniTempBuffer = new Float32Array(GL.MINI_TEMP_BUFFER_SIZE);
    for (var i = 0; i < GL.MINI_TEMP_BUFFER_SIZE; i++) {
      GL.miniTempBufferViews[i] = GL.miniTempBuffer.subarray(0, i + 1);
    }
  },
  recordError: function recordError(errorCode) {
    if (!GL.lastError) {
      GL.lastError = errorCode;
    }
  },
  getNewId: function(table) {
    var ret = GL.counter++;
    for (var i = table.length; i < ret; i++) {
      table[i] = null;
    }
    return ret;
  },
  MINI_TEMP_BUFFER_SIZE: 256,
  miniTempBuffer: null,
  miniTempBufferViews: [0],
  getSource: function(shader, count, string, length) {
    var source = "";
    for (var i = 0; i < count; ++i) {
      var len = length ? HEAP32[(length + i * 4) >> 2] : -1;
      source += UTF8ToString(
        HEAP32[(string + i * 4) >> 2],
        len < 0 ? undefined : len
      );
    }
    return source;
  },
  createContext: function(canvas, webGLContextAttributes) {
    var ctx =
      webGLContextAttributes.majorVersion > 1
        ? canvas.getContext("webgl2", webGLContextAttributes)
        : canvas.getContext("webgl", webGLContextAttributes) ||
          canvas.getContext("experimental-webgl", webGLContextAttributes);
    return ctx && GL.registerContext(ctx, webGLContextAttributes);
  },
  registerContext: function(ctx, webGLContextAttributes) {
    var handle = _malloc(8);
    var context = {
      handle: handle,
      attributes: webGLContextAttributes,
      version: webGLContextAttributes.majorVersion,
      GLctx: ctx
    };
    function getChromeVersion() {
      var raw = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);
      return raw ? parseInt(raw[2], 10) : false;
    }
    context.supportsWebGL2EntryPoints =
      context.version >= 2 &&
      (getChromeVersion() === false || getChromeVersion() >= 58);
    if (ctx.canvas) ctx.canvas.GLctxObject = context;
    GL.contexts[handle] = context;
    if (
      typeof webGLContextAttributes.enableExtensionsByDefault === "undefined" ||
      webGLContextAttributes.enableExtensionsByDefault
    ) {
      GL.initExtensions(context);
    }
    return handle;
  },
  makeContextCurrent: function(contextHandle) {
    GL.currentContext = GL.contexts[contextHandle];
    Module.ctx = GLctx = GL.currentContext && GL.currentContext.GLctx;
    return !(contextHandle && !GLctx);
  },
  getContext: function(contextHandle) {
    return GL.contexts[contextHandle];
  },
  deleteContext: function(contextHandle) {
    if (GL.currentContext === GL.contexts[contextHandle])
      GL.currentContext = null;
    if (typeof JSEvents === "object")
      JSEvents.removeAllHandlersOnTarget(
        GL.contexts[contextHandle].GLctx.canvas
      );
    if (GL.contexts[contextHandle] && GL.contexts[contextHandle].GLctx.canvas)
      GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined;
    _free(GL.contexts[contextHandle]);
    GL.contexts[contextHandle] = null;
  },
  initExtensions: function(context) {
    if (!context) context = GL.currentContext;
    if (context.initExtensionsDone) return;
    context.initExtensionsDone = true;
    var GLctx = context.GLctx;
    if (context.version < 2) {
      var instancedArraysExt = GLctx.getExtension("ANGLE_instanced_arrays");
      if (instancedArraysExt) {
        GLctx["vertexAttribDivisor"] = function(index, divisor) {
          instancedArraysExt["vertexAttribDivisorANGLE"](index, divisor);
        };
        GLctx["drawArraysInstanced"] = function(mode, first, count, primcount) {
          instancedArraysExt["drawArraysInstancedANGLE"](
            mode,
            first,
            count,
            primcount
          );
        };
        GLctx["drawElementsInstanced"] = function(
          mode,
          count,
          type,
          indices,
          primcount
        ) {
          instancedArraysExt["drawElementsInstancedANGLE"](
            mode,
            count,
            type,
            indices,
            primcount
          );
        };
      }
      var vaoExt = GLctx.getExtension("OES_vertex_array_object");
      if (vaoExt) {
        GLctx["createVertexArray"] = function() {
          return vaoExt["createVertexArrayOES"]();
        };
        GLctx["deleteVertexArray"] = function(vao) {
          vaoExt["deleteVertexArrayOES"](vao);
        };
        GLctx["bindVertexArray"] = function(vao) {
          vaoExt["bindVertexArrayOES"](vao);
        };
        GLctx["isVertexArray"] = function(vao) {
          return vaoExt["isVertexArrayOES"](vao);
        };
      }
      var drawBuffersExt = GLctx.getExtension("WEBGL_draw_buffers");
      if (drawBuffersExt) {
        GLctx["drawBuffers"] = function(n, bufs) {
          drawBuffersExt["drawBuffersWEBGL"](n, bufs);
        };
      }
    }
    GLctx.disjointTimerQueryExt = GLctx.getExtension(
      "EXT_disjoint_timer_query"
    );
    var automaticallyEnabledExtensions = [
      "OES_texture_float",
      "OES_texture_half_float",
      "OES_standard_derivatives",
      "OES_vertex_array_object",
      "WEBGL_compressed_texture_s3tc",
      "WEBGL_depth_texture",
      "OES_element_index_uint",
      "EXT_texture_filter_anisotropic",
      "EXT_frag_depth",
      "WEBGL_draw_buffers",
      "ANGLE_instanced_arrays",
      "OES_texture_float_linear",
      "OES_texture_half_float_linear",
      "EXT_blend_minmax",
      "EXT_shader_texture_lod",
      "WEBGL_compressed_texture_pvrtc",
      "EXT_color_buffer_half_float",
      "WEBGL_color_buffer_float",
      "EXT_sRGB",
      "WEBGL_compressed_texture_etc1",
      "EXT_disjoint_timer_query",
      "WEBGL_compressed_texture_etc",
      "WEBGL_compressed_texture_astc",
      "EXT_color_buffer_float",
      "WEBGL_compressed_texture_s3tc_srgb",
      "EXT_disjoint_timer_query_webgl2"
    ];
    var exts = GLctx.getSupportedExtensions();
    if (exts && exts.length > 0) {
      GLctx.getSupportedExtensions().forEach(function(ext) {
        if (automaticallyEnabledExtensions.indexOf(ext) != -1) {
          GLctx.getExtension(ext);
        }
      });
    }
  },
  populateUniformTable: function(program) {
    var p = GL.programs[program];
    var ptable = (GL.programInfos[program] = {
      uniforms: {},
      maxUniformLength: 0,
      maxAttributeLength: -1,
      maxUniformBlockNameLength: -1
    });
    var utable = ptable.uniforms;
    var numUniforms = GLctx.getProgramParameter(p, 35718);
    for (var i = 0; i < numUniforms; ++i) {
      var u = GLctx.getActiveUniform(p, i);
      var name = u.name;
      ptable.maxUniformLength = Math.max(
        ptable.maxUniformLength,
        name.length + 1
      );
      if (name.slice(-1) == "]") {
        name = name.slice(0, name.lastIndexOf("["));
      }
      var loc = GLctx.getUniformLocation(p, name);
      if (loc) {
        var id = GL.getNewId(GL.uniforms);
        utable[name] = [u.size, id];
        GL.uniforms[id] = loc;
        for (var j = 1; j < u.size; ++j) {
          var n = name + "[" + j + "]";
          loc = GLctx.getUniformLocation(p, n);
          id = GL.getNewId(GL.uniforms);
          GL.uniforms[id] = loc;
        }
      }
    }
  }
};
var JSEvents = {
  keyEvent: 0,
  mouseEvent: 0,
  wheelEvent: 0,
  uiEvent: 0,
  focusEvent: 0,
  deviceOrientationEvent: 0,
  deviceMotionEvent: 0,
  fullscreenChangeEvent: 0,
  pointerlockChangeEvent: 0,
  visibilityChangeEvent: 0,
  touchEvent: 0,
  previousFullscreenElement: null,
  previousScreenX: null,
  previousScreenY: null,
  removeEventListenersRegistered: false,
  removeAllEventListeners: function() {
    for (var i = JSEvents.eventHandlers.length - 1; i >= 0; --i) {
      JSEvents._removeHandler(i);
    }
    JSEvents.eventHandlers = [];
    JSEvents.deferredCalls = [];
  },
  registerRemoveEventListeners: function() {
    if (!JSEvents.removeEventListenersRegistered) {
      __ATEXIT__.push(JSEvents.removeAllEventListeners);
      JSEvents.removeEventListenersRegistered = true;
    }
  },
  deferredCalls: [],
  deferCall: function(targetFunction, precedence, argsList) {
    function arraysHaveEqualContent(arrA, arrB) {
      if (arrA.length != arrB.length) return false;
      for (var i in arrA) {
        if (arrA[i] != arrB[i]) return false;
      }
      return true;
    }
    for (var i in JSEvents.deferredCalls) {
      var call = JSEvents.deferredCalls[i];
      if (
        call.targetFunction == targetFunction &&
        arraysHaveEqualContent(call.argsList, argsList)
      ) {
        return;
      }
    }
    JSEvents.deferredCalls.push({
      targetFunction: targetFunction,
      precedence: precedence,
      argsList: argsList
    });
    JSEvents.deferredCalls.sort(function(x, y) {
      return x.precedence < y.precedence;
    });
  },
  removeDeferredCalls: function(targetFunction) {
    for (var i = 0; i < JSEvents.deferredCalls.length; ++i) {
      if (JSEvents.deferredCalls[i].targetFunction == targetFunction) {
        JSEvents.deferredCalls.splice(i, 1);
        --i;
      }
    }
  },
  canPerformEventHandlerRequests: function() {
    return (
      JSEvents.inEventHandler &&
      JSEvents.currentEventHandler.allowsDeferredCalls
    );
  },
  runDeferredCalls: function() {
    if (!JSEvents.canPerformEventHandlerRequests()) {
      return;
    }
    for (var i = 0; i < JSEvents.deferredCalls.length; ++i) {
      var call = JSEvents.deferredCalls[i];
      JSEvents.deferredCalls.splice(i, 1);
      --i;
      call.targetFunction.apply(this, call.argsList);
    }
  },
  inEventHandler: 0,
  currentEventHandler: null,
  eventHandlers: [],
  isInternetExplorer: function() {
    return (
      navigator.userAgent.indexOf("MSIE") !== -1 ||
      navigator.appVersion.indexOf("Trident/") > 0
    );
  },
  removeAllHandlersOnTarget: function(target, eventTypeString) {
    for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
      if (
        JSEvents.eventHandlers[i].target == target &&
        (!eventTypeString ||
          eventTypeString == JSEvents.eventHandlers[i].eventTypeString)
      ) {
        JSEvents._removeHandler(i--);
      }
    }
  },
  _removeHandler: function(i) {
    var h = JSEvents.eventHandlers[i];
    h.target.removeEventListener(
      h.eventTypeString,
      h.eventListenerFunc,
      h.useCapture
    );
    JSEvents.eventHandlers.splice(i, 1);
  },
  registerOrRemoveHandler: function(eventHandler) {
    var jsEventHandler = function jsEventHandler(event) {
      ++JSEvents.inEventHandler;
      JSEvents.currentEventHandler = eventHandler;
      JSEvents.runDeferredCalls();
      eventHandler.handlerFunc(event);
      JSEvents.runDeferredCalls();
      --JSEvents.inEventHandler;
    };
    if (eventHandler.callbackfunc) {
      eventHandler.eventListenerFunc = jsEventHandler;
      eventHandler.target.addEventListener(
        eventHandler.eventTypeString,
        jsEventHandler,
        eventHandler.useCapture
      );
      JSEvents.eventHandlers.push(eventHandler);
      JSEvents.registerRemoveEventListeners();
    } else {
      for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
        if (
          JSEvents.eventHandlers[i].target == eventHandler.target &&
          JSEvents.eventHandlers[i].eventTypeString ==
            eventHandler.eventTypeString
        ) {
          JSEvents._removeHandler(i--);
        }
      }
    }
  },
  getBoundingClientRectOrZeros: function(target) {
    return target.getBoundingClientRect
      ? target.getBoundingClientRect()
      : { left: 0, top: 0 };
  },
  pageScrollPos: function() {
    if (window.pageXOffset > 0 || window.pageYOffset > 0) {
      return [window.pageXOffset, window.pageYOffset];
    }
    if (
      typeof document.documentElement.scrollLeft !== "undefined" ||
      typeof document.documentElement.scrollTop !== "undefined"
    ) {
      return [
        document.documentElement.scrollLeft,
        document.documentElement.scrollTop
      ];
    }
    return [document.body.scrollLeft | 0, document.body.scrollTop | 0];
  },
  getNodeNameForTarget: function(target) {
    if (!target) return "";
    if (target == window) return "#window";
    if (target == screen) return "#screen";
    return target && target.nodeName ? target.nodeName : "";
  },
  tick: function() {
    if (window["performance"] && window["performance"]["now"])
      return window["performance"]["now"]();
    else return Date.now();
  },
  fullscreenEnabled: function() {
    return (
      document.fullscreenEnabled ||
      document.mozFullScreenEnabled ||
      document.webkitFullscreenEnabled ||
      document.msFullscreenEnabled
    );
  }
};
var __emscripten_webgl_power_preferences = [
  "default",
  "low-power",
  "high-performance"
];
var __specialEventTargets = [
  0,
  typeof document !== "undefined" ? document : 0,
  typeof window !== "undefined" ? window : 0
];
function __findEventTarget(target) {
  try {
    if (!target) return window;
    if (typeof target === "number")
      target = __specialEventTargets[target] || UTF8ToString(target);
    if (target === "#window") return window;
    else if (target === "#document") return document;
    else if (target === "#screen") return screen;
    else if (target === "#canvas") return Module["canvas"];
    return typeof target === "string"
      ? document.getElementById(target)
      : target;
  } catch (e) {
    return null;
  }
}
function __findCanvasEventTarget(target) {
  if (typeof target === "number") target = UTF8ToString(target);
  if (!target || target === "#canvas") {
    if (typeof GL !== "undefined" && GL.offscreenCanvases["canvas"])
      return GL.offscreenCanvases["canvas"];
    return Module["canvas"];
  }
  if (typeof GL !== "undefined" && GL.offscreenCanvases[target])
    return GL.offscreenCanvases[target];
  return __findEventTarget(target);
}
function _emscripten_webgl_do_create_context(target, attributes) {
  var contextAttributes = {};
  var a = attributes >> 2;
  contextAttributes["alpha"] = !!HEAP32[a + (0 >> 2)];
  contextAttributes["depth"] = !!HEAP32[a + (4 >> 2)];
  contextAttributes["stencil"] = !!HEAP32[a + (8 >> 2)];
  contextAttributes["antialias"] = !!HEAP32[a + (12 >> 2)];
  contextAttributes["premultipliedAlpha"] = !!HEAP32[a + (16 >> 2)];
  contextAttributes["preserveDrawingBuffer"] = !!HEAP32[a + (20 >> 2)];
  var powerPreference = HEAP32[a + (24 >> 2)];
  contextAttributes["powerPreference"] =
    __emscripten_webgl_power_preferences[powerPreference];
  contextAttributes["failIfMajorPerformanceCaveat"] = !!HEAP32[a + (28 >> 2)];
  contextAttributes.majorVersion = HEAP32[a + (32 >> 2)];
  contextAttributes.minorVersion = HEAP32[a + (36 >> 2)];
  contextAttributes.enableExtensionsByDefault = HEAP32[a + (40 >> 2)];
  contextAttributes.explicitSwapControl = HEAP32[a + (44 >> 2)];
  contextAttributes.proxyContextToMainThread = HEAP32[a + (48 >> 2)];
  contextAttributes.renderViaOffscreenBackBuffer = HEAP32[a + (52 >> 2)];
  var canvas = __findCanvasEventTarget(target);
  if (!canvas) {
    return 0;
  }
  if (contextAttributes.explicitSwapControl) {
    return 0;
  }
  var contextHandle = GL.createContext(canvas, contextAttributes);
  return contextHandle;
}
function _emscripten_webgl_create_context(a0, a1) {
  return _emscripten_webgl_do_create_context(a0, a1);
}
function _emscripten_webgl_destroy_context_calling_thread(contextHandle) {
  if (GL.currentContext == contextHandle) GL.currentContext = 0;
  GL.deleteContext(contextHandle);
}
function _emscripten_webgl_destroy_context(a0) {
  return _emscripten_webgl_destroy_context_calling_thread(a0);
}
function _emscripten_webgl_make_context_current(contextHandle) {
  var success = GL.makeContextCurrent(contextHandle);
  return success ? 0 : -5;
}
Module[
  "_emscripten_webgl_make_context_current"
] = _emscripten_webgl_make_context_current;
function _glActiveTexture(x0) {
  GLctx["activeTexture"](x0);
}
function _glAttachShader(program, shader) {
  GLctx.attachShader(GL.programs[program], GL.shaders[shader]);
}
function _glBindAttribLocation(program, index, name) {
  GLctx.bindAttribLocation(GL.programs[program], index, UTF8ToString(name));
}
function _glBindBuffer(target, buffer) {
  if (target == 35051) {
    GLctx.currentPixelPackBufferBinding = buffer;
  } else if (target == 35052) {
    GLctx.currentPixelUnpackBufferBinding = buffer;
  }
  GLctx.bindBuffer(target, GL.buffers[buffer]);
}
function _glBindTexture(target, texture) {
  GLctx.bindTexture(target, GL.textures[texture]);
}
function _glBufferData(target, size, data, usage) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    if (data) {
      GLctx.bufferData(target, HEAPU8, usage, data, size);
    } else {
      GLctx.bufferData(target, size, usage);
    }
  } else {
    GLctx.bufferData(
      target,
      data ? HEAPU8.subarray(data, data + size) : size,
      usage
    );
  }
}
function _glClear(x0) {
  GLctx["clear"](x0);
}
function _glCompileShader(shader) {
  GLctx.compileShader(GL.shaders[shader]);
}
function _glCreateProgram() {
  var id = GL.getNewId(GL.programs);
  var program = GLctx.createProgram();
  program.name = id;
  GL.programs[id] = program;
  return id;
}
function _glCreateShader(shaderType) {
  var id = GL.getNewId(GL.shaders);
  GL.shaders[id] = GLctx.createShader(shaderType);
  return id;
}
function _glDrawElements(mode, count, type, indices) {
  GLctx.drawElements(mode, count, type, indices);
}
function _glEnableVertexAttribArray(index) {
  GLctx.enableVertexAttribArray(index);
}
function __glGenObject(n, buffers, createFunction, objectTable) {
  for (var i = 0; i < n; i++) {
    var buffer = GLctx[createFunction]();
    var id = buffer && GL.getNewId(objectTable);
    if (buffer) {
      buffer.name = id;
      objectTable[id] = buffer;
    } else {
      GL.recordError(1282);
    }
    HEAP32[(buffers + i * 4) >> 2] = id;
  }
}
function _glGenBuffers(n, buffers) {
  __glGenObject(n, buffers, "createBuffer", GL.buffers);
}
function _glGenTextures(n, textures) {
  __glGenObject(n, textures, "createTexture", GL.textures);
}
function _glGetAttribLocation(program, name) {
  return GLctx.getAttribLocation(GL.programs[program], UTF8ToString(name));
}
function _glGetShaderInfoLog(shader, maxLength, length, infoLog) {
  var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
  if (log === null) log = "(unknown error)";
  if (maxLength > 0 && infoLog) {
    var numBytesWrittenExclNull = stringToUTF8(log, infoLog, maxLength);
    if (length) HEAP32[length >> 2] = numBytesWrittenExclNull;
  } else {
    if (length) HEAP32[length >> 2] = 0;
  }
}
function _glGetShaderiv(shader, pname, p) {
  if (!p) {
    GL.recordError(1281);
    return;
  }
  if (pname == 35716) {
    var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
    if (log === null) log = "(unknown error)";
    HEAP32[p >> 2] = log.length + 1;
  } else if (pname == 35720) {
    var source = GLctx.getShaderSource(GL.shaders[shader]);
    var sourceLength =
      source === null || source.length == 0 ? 0 : source.length + 1;
    HEAP32[p >> 2] = sourceLength;
  } else {
    HEAP32[p >> 2] = GLctx.getShaderParameter(GL.shaders[shader], pname);
  }
}
function _glGetUniformLocation(program, name) {
  name = UTF8ToString(name);
  var arrayIndex = 0;
  if (name[name.length - 1] == "]") {
    var leftBrace = name.lastIndexOf("[");
    arrayIndex =
      name[leftBrace + 1] != "]" ? parseInt(name.slice(leftBrace + 1)) : 0;
    name = name.slice(0, leftBrace);
  }
  var uniformInfo =
    GL.programInfos[program] && GL.programInfos[program].uniforms[name];
  if (uniformInfo && arrayIndex >= 0 && arrayIndex < uniformInfo[0]) {
    return uniformInfo[1] + arrayIndex;
  } else {
    return -1;
  }
}
function _glLinkProgram(program) {
  GLctx.linkProgram(GL.programs[program]);
  GL.populateUniformTable(program);
}
function _glShaderSource(shader, count, string, length) {
  var source = GL.getSource(shader, count, string, length);
  GLctx.shaderSource(GL.shaders[shader], source);
}
function __computeUnpackAlignedImageSize(
  width,
  height,
  sizePerPixel,
  alignment
) {
  function roundedToNextMultipleOf(x, y) {
    return (x + y - 1) & -y;
  }
  var plainRowSize = width * sizePerPixel;
  var alignedRowSize = roundedToNextMultipleOf(plainRowSize, alignment);
  return height * alignedRowSize;
}
var __colorChannelsInGlTextureFormat = {
  6402: 1,
  6403: 1,
  6406: 1,
  6407: 3,
  6408: 4,
  6409: 1,
  6410: 2,
  33319: 2,
  33320: 2,
  35904: 3,
  35906: 4,
  36244: 1,
  36248: 3,
  36249: 4
};
var __sizeOfGlTextureElementType = {
  5120: 1,
  5121: 1,
  5122: 2,
  5123: 2,
  5124: 4,
  5125: 4,
  5126: 4,
  5131: 2,
  32819: 2,
  32820: 2,
  33635: 2,
  33640: 4,
  34042: 4,
  35899: 4,
  35902: 4,
  36193: 2
};
function emscriptenWebGLGetTexPixelData(
  type,
  format,
  width,
  height,
  pixels,
  internalFormat
) {
  var sizePerPixel =
    __colorChannelsInGlTextureFormat[format] *
    __sizeOfGlTextureElementType[type];
  if (!sizePerPixel) {
    GL.recordError(1280);
    return;
  }
  var bytes = __computeUnpackAlignedImageSize(
    width,
    height,
    sizePerPixel,
    GL.unpackAlignment
  );
  var end = pixels + bytes;
  switch (type) {
    case 5120:
      return HEAP8.subarray(pixels, end);
    case 5121:
      return HEAPU8.subarray(pixels, end);
    case 5122:
      return HEAP16.subarray(pixels >> 1, end >> 1);
    case 5124:
      return HEAP32.subarray(pixels >> 2, end >> 2);
    case 5126:
      return HEAPF32.subarray(pixels >> 2, end >> 2);
    case 5125:
    case 34042:
    case 35902:
    case 33640:
    case 35899:
    case 34042:
      return HEAPU32.subarray(pixels >> 2, end >> 2);
    case 5123:
    case 33635:
    case 32819:
    case 32820:
    case 36193:
    case 5131:
      return HEAPU16.subarray(pixels >> 1, end >> 1);
    default:
      GL.recordError(1280);
  }
}
function __heapObjectForWebGLType(type) {
  switch (type) {
    case 5120:
      return HEAP8;
    case 5121:
      return HEAPU8;
    case 5122:
      return HEAP16;
    case 5123:
    case 33635:
    case 32819:
    case 32820:
    case 36193:
    case 5131:
      return HEAPU16;
    case 5124:
      return HEAP32;
    case 5125:
    case 34042:
    case 35902:
    case 33640:
    case 35899:
    case 34042:
      return HEAPU32;
    case 5126:
      return HEAPF32;
  }
}
var __heapAccessShiftForWebGLType = {
  5122: 1,
  5123: 1,
  5124: 2,
  5125: 2,
  5126: 2,
  5131: 1,
  32819: 1,
  32820: 1,
  33635: 1,
  33640: 2,
  34042: 2,
  35899: 2,
  35902: 2,
  36193: 1
};
function _glTexImage2D(
  target,
  level,
  internalFormat,
  width,
  height,
  border,
  format,
  type,
  pixels
) {
  if (GL.currentContext.supportsWebGL2EntryPoints) {
    if (GLctx.currentPixelUnpackBufferBinding) {
      GLctx.texImage2D(
        target,
        level,
        internalFormat,
        width,
        height,
        border,
        format,
        type,
        pixels
      );
    } else if (pixels != 0) {
      GLctx.texImage2D(
        target,
        level,
        internalFormat,
        width,
        height,
        border,
        format,
        type,
        __heapObjectForWebGLType(type),
        pixels >> (__heapAccessShiftForWebGLType[type] | 0)
      );
    } else {
      GLctx.texImage2D(
        target,
        level,
        internalFormat,
        width,
        height,
        border,
        format,
        type,
        null
      );
    }
    return;
  }
  GLctx.texImage2D(
    target,
    level,
    internalFormat,
    width,
    height,
    border,
    format,
    type,
    pixels
      ? emscriptenWebGLGetTexPixelData(
          type,
          format,
          width,
          height,
          pixels,
          internalFormat
        )
      : null
  );
}
function _glTexParameteri(x0, x1, x2) {
  GLctx["texParameteri"](x0, x1, x2);
}
function _glUniform1f(location, v0) {
  GLctx.uniform1f(GL.uniforms[location], v0);
}
function _glUniform1i(location, v0) {
  GLctx.uniform1i(GL.uniforms[location], v0);
}
function _glUseProgram(program) {
  GLctx.useProgram(GL.programs[program]);
}
function _glValidateProgram(program) {
  GLctx.validateProgram(GL.programs[program]);
}
function _glVertexAttribPointer(index, size, type, normalized, stride, ptr) {
  GLctx.vertexAttribPointer(index, size, type, !!normalized, stride, ptr);
}
function _glViewport(x0, x1, x2, x3) {
  GLctx["viewport"](x0, x1, x2, x3);
}
function _llvm_stackrestore(p) {
  var self = _llvm_stacksave;
  var ret = self.LLVM_SAVEDSTACKS[p];
  self.LLVM_SAVEDSTACKS.splice(p, 1);
  stackRestore(ret);
}
function _llvm_stacksave() {
  var self = _llvm_stacksave;
  if (!self.LLVM_SAVEDSTACKS) {
    self.LLVM_SAVEDSTACKS = [];
  }
  self.LLVM_SAVEDSTACKS.push(stackSave());
  return self.LLVM_SAVEDSTACKS.length - 1;
}
function _emscripten_memcpy_big(dest, src, num) {
  HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
}
function ___setErrNo(value) {
  if (Module["___errno_location"])
    HEAP32[Module["___errno_location"]() >> 2] = value;
  return value;
}
var GLctx;
GL.init();
var ASSERTIONS = false;
var asmGlobalArg = {};
var asmLibraryArg = {
  abort: abort,
  setTempRet0: setTempRet0,
  getTempRet0: getTempRet0,
  __ZSt18uncaught_exceptionv: __ZSt18uncaught_exceptionv,
  ___cxa_begin_catch: ___cxa_begin_catch,
  ___cxa_find_matching_catch: ___cxa_find_matching_catch,
  ___cxa_free_exception: ___cxa_free_exception,
  ___gxx_personality_v0: ___gxx_personality_v0,
  ___resumeException: ___resumeException,
  ___setErrNo: ___setErrNo,
  ___syscall140: ___syscall140,
  ___syscall146: ___syscall146,
  ___syscall54: ___syscall54,
  ___syscall6: ___syscall6,
  __computeUnpackAlignedImageSize: __computeUnpackAlignedImageSize,
  __findCanvasEventTarget: __findCanvasEventTarget,
  __findEventTarget: __findEventTarget,
  __glGenObject: __glGenObject,
  __heapObjectForWebGLType: __heapObjectForWebGLType,
  _abort: _abort,
  _emscripten_asm_const_i: _emscripten_asm_const_i,
  _emscripten_get_heap_size: _emscripten_get_heap_size,
  _emscripten_memcpy_big: _emscripten_memcpy_big,
  _emscripten_resize_heap: _emscripten_resize_heap,
  _emscripten_webgl_create_context: _emscripten_webgl_create_context,
  _emscripten_webgl_destroy_context: _emscripten_webgl_destroy_context,
  _emscripten_webgl_destroy_context_calling_thread: _emscripten_webgl_destroy_context_calling_thread,
  _emscripten_webgl_do_create_context: _emscripten_webgl_do_create_context,
  _emscripten_webgl_make_context_current: _emscripten_webgl_make_context_current,
  _glActiveTexture: _glActiveTexture,
  _glAttachShader: _glAttachShader,
  _glBindAttribLocation: _glBindAttribLocation,
  _glBindBuffer: _glBindBuffer,
  _glBindTexture: _glBindTexture,
  _glBufferData: _glBufferData,
  _glClear: _glClear,
  _glCompileShader: _glCompileShader,
  _glCreateProgram: _glCreateProgram,
  _glCreateShader: _glCreateShader,
  _glDrawElements: _glDrawElements,
  _glEnableVertexAttribArray: _glEnableVertexAttribArray,
  _glGenBuffers: _glGenBuffers,
  _glGenTextures: _glGenTextures,
  _glGetAttribLocation: _glGetAttribLocation,
  _glGetShaderInfoLog: _glGetShaderInfoLog,
  _glGetShaderiv: _glGetShaderiv,
  _glGetUniformLocation: _glGetUniformLocation,
  _glLinkProgram: _glLinkProgram,
  _glShaderSource: _glShaderSource,
  _glTexImage2D: _glTexImage2D,
  _glTexParameteri: _glTexParameteri,
  _glUniform1f: _glUniform1f,
  _glUniform1i: _glUniform1i,
  _glUseProgram: _glUseProgram,
  _glValidateProgram: _glValidateProgram,
  _glVertexAttribPointer: _glVertexAttribPointer,
  _glViewport: _glViewport,
  _llvm_stackrestore: _llvm_stackrestore,
  _llvm_stacksave: _llvm_stacksave,
  abortOnCannotGrowMemory: abortOnCannotGrowMemory,
  emscriptenWebGLGetTexPixelData: emscriptenWebGLGetTexPixelData,
  emscripten_realloc_buffer: emscripten_realloc_buffer,
  flush_NO_FILESYSTEM: flush_NO_FILESYSTEM,
  tempDoublePtr: tempDoublePtr,
  DYNAMICTOP_PTR: DYNAMICTOP_PTR
};
var asm = Module["asm"](asmGlobalArg, asmLibraryArg, buffer);
Module["asm"] = asm;
var __GLOBAL__sub_I_emscripten_cpp = (Module[
  "__GLOBAL__sub_I_emscripten_cpp"
] = function() {
  return Module["asm"]["__GLOBAL__sub_I_emscripten_cpp"].apply(null, arguments);
});
var ___cxa_can_catch = (Module["___cxa_can_catch"] = function() {
  return Module["asm"]["___cxa_can_catch"].apply(null, arguments);
});
var ___cxa_is_pointer_type = (Module["___cxa_is_pointer_type"] = function() {
  return Module["asm"]["___cxa_is_pointer_type"].apply(null, arguments);
});
var ___errno_location = (Module["___errno_location"] = function() {
  return Module["asm"]["___errno_location"].apply(null, arguments);
});
var _clearContexts = (Module["_clearContexts"] = function() {
  return Module["asm"]["_clearContexts"].apply(null, arguments);
});
var _createContext = (Module["_createContext"] = function() {
  return Module["asm"]["_createContext"].apply(null, arguments);
});
var _detectEdges = (Module["_detectEdges"] = function() {
  return Module["asm"]["_detectEdges"].apply(null, arguments);
});
var _emscripten_replace_memory = (Module[
  "_emscripten_replace_memory"
] = function() {
  return Module["asm"]["_emscripten_replace_memory"].apply(null, arguments);
});
var _free = (Module["_free"] = function() {
  return Module["asm"]["_free"].apply(null, arguments);
});
var _loadTexture = (Module["_loadTexture"] = function() {
  return Module["asm"]["_loadTexture"].apply(null, arguments);
});
var _main = (Module["_main"] = function() {
  return Module["asm"]["_main"].apply(null, arguments);
});
var _malloc = (Module["_malloc"] = function() {
  return Module["asm"]["_malloc"].apply(null, arguments);
});
var _memcpy = (Module["_memcpy"] = function() {
  return Module["asm"]["_memcpy"].apply(null, arguments);
});
var _memset = (Module["_memset"] = function() {
  return Module["asm"]["_memset"].apply(null, arguments);
});
var _sbrk = (Module["_sbrk"] = function() {
  return Module["asm"]["_sbrk"].apply(null, arguments);
});
var establishStackSpace = (Module["establishStackSpace"] = function() {
  return Module["asm"]["establishStackSpace"].apply(null, arguments);
});
var stackAlloc = (Module["stackAlloc"] = function() {
  return Module["asm"]["stackAlloc"].apply(null, arguments);
});
var stackRestore = (Module["stackRestore"] = function() {
  return Module["asm"]["stackRestore"].apply(null, arguments);
});
var stackSave = (Module["stackSave"] = function() {
  return Module["asm"]["stackSave"].apply(null, arguments);
});
var dynCall_ii = (Module["dynCall_ii"] = function() {
  return Module["asm"]["dynCall_ii"].apply(null, arguments);
});
var dynCall_iiii = (Module["dynCall_iiii"] = function() {
  return Module["asm"]["dynCall_iiii"].apply(null, arguments);
});
var dynCall_v = (Module["dynCall_v"] = function() {
  return Module["asm"]["dynCall_v"].apply(null, arguments);
});
var dynCall_vi = (Module["dynCall_vi"] = function() {
  return Module["asm"]["dynCall_vi"].apply(null, arguments);
});
var dynCall_viiii = (Module["dynCall_viiii"] = function() {
  return Module["asm"]["dynCall_viiii"].apply(null, arguments);
});
var dynCall_viiiii = (Module["dynCall_viiiii"] = function() {
  return Module["asm"]["dynCall_viiiii"].apply(null, arguments);
});
var dynCall_viiiiii = (Module["dynCall_viiiiii"] = function() {
  return Module["asm"]["dynCall_viiiiii"].apply(null, arguments);
});
Module["asm"] = asm;
Module["ccall"] = ccall;
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
}
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;
var calledMain = false;
dependenciesFulfilled = function runCaller() {
  if (!Module["calledRun"]) run();
  if (!Module["calledRun"]) dependenciesFulfilled = runCaller;
};
Module["callMain"] = function callMain(args) {
  args = args || [];
  ensureInitRuntime();
  var argc = args.length + 1;
  var argv = stackAlloc((argc + 1) * 4);
  HEAP32[argv >> 2] = allocateUTF8OnStack(Module["thisProgram"]);
  for (var i = 1; i < argc; i++) {
    HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1]);
  }
  HEAP32[(argv >> 2) + argc] = 0;
  try {
    var ret = Module["_main"](argc, argv, 0);
    exit(ret, true);
  } catch (e) {
    if (e instanceof ExitStatus) {
      return;
    } else if (e == "SimulateInfiniteLoop") {
      Module["noExitRuntime"] = true;
      return;
    } else {
      var toLog = e;
      if (e && typeof e === "object" && e.stack) {
        toLog = [e, e.stack];
      }
      err("exception thrown: " + toLog);
      Module["quit"](1, e);
    }
  } finally {
    calledMain = true;
  }
};
function run(args) {
  args = args || Module["arguments"];
  if (runDependencies > 0) {
    return;
  }
  preRun();
  if (runDependencies > 0) return;
  if (Module["calledRun"]) return;
  function doRun() {
    if (Module["calledRun"]) return;
    Module["calledRun"] = true;
    if (ABORT) return;
    ensureInitRuntime();
    preMain();
    if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
    if (Module["_main"] && shouldRunNow) Module["callMain"](args);
    postRun();
  }
  if (Module["setStatus"]) {
    Module["setStatus"]("Running...");
    setTimeout(function() {
      setTimeout(function() {
        Module["setStatus"]("");
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
}
Module["run"] = run;
function exit(status, implicit) {
  if (implicit && Module["noExitRuntime"] && status === 0) {
    return;
  }
  if (Module["noExitRuntime"]) {
  } else {
    ABORT = true;
    EXITSTATUS = status;
    exitRuntime();
    if (Module["onExit"]) Module["onExit"](status);
  }
  Module["quit"](status, new ExitStatus(status));
}
function abort(what) {
  if (Module["onAbort"]) {
    Module["onAbort"](what);
  }
  if (what !== undefined) {
    out(what);
    err(what);
    what = JSON.stringify(what);
  } else {
    what = "";
  }
  ABORT = true;
  EXITSTATUS = 1;
  throw "abort(" + what + "). Build with -s ASSERTIONS=1 for more info.";
}
Module["abort"] = abort;
if (Module["preInit"]) {
  if (typeof Module["preInit"] == "function")
    Module["preInit"] = [Module["preInit"]];
  while (Module["preInit"].length > 0) {
    Module["preInit"].pop()();
  }
}
var shouldRunNow = true;
if (Module["noInitialRun"]) {
  shouldRunNow = false;
}
Module["noExitRuntime"] = true;
run();
