"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var assemblyscript_1 = require("assemblyscript");
var ts = require("typescript");
var fs = require("fs");
var wasmFooterPath = __dirname + '/wasmFooter.js';
var wasmFooter = fs.readFileSync(wasmFooterPath, 'utf-8');
/**
 * compile assemblyscript to WebAssembly(wasm)
 * @param {string} source - assemblyscript string
 * @returns {Buffer} wasm stream as a Buffer
 */
function compile(source) {
    var module = assemblyscript_1.Compiler.compileString(source, {
        target: assemblyscript_1.CompilerTarget.WASM32,
        memoryModel: assemblyscript_1.CompilerMemoryModel.MALLOC,
        silent: true
    });
    var wasmFile;
    if (!module) {
        throw Error('compilation failed');
    }
    module.optimize();
    if (!module.validate()) {
        throw Error('validation failed');
    }
    wasmFile = module.emitBinary();
    module.dispose();
    return new Buffer(wasmFile);
}
/**
 * Create a module using WebAssembly.Module
 * @param {string} source assemblyscript source
 * @param {Buffer} wasm WebAssembly Buffer
 * @returns {string} module string
 */
function createWasmModule(source, wasm) {
    var length = wasm.length;
    var buffer = [];
    for (var i = 0; i < length; i += 1) {
        buffer.push(wasm[i]);
    }
    var module = "var buffer = new ArrayBuffer(" + wasm.length + ");\n        var uint8 = new Uint8Array(buffer);\n        uint8.set([" + buffer.join(',') + "]);\n        " + wasmFooter;
    return module;
}
/**
 * Creates commonjs module for javascript
 * @param {string} source assemblyscript source
 * @returns {string} module string
 */
function createJsModule(source) {
    var compilerOptions = {
        compilerOptions: {
            target: ts.ScriptTarget.ES5,
            module: ts.ModuleKind.CommonJS,
            alwaysStrict: false
        }
    };
    var transpiled = ts.transpileModule(source, compilerOptions);
    return transpiled.outputText;
}
/**
 * Creates compatible module with Javascript, WebAssembly both
 * @param {string} jsModule - javascript module
 * @param {string} wasmModule - WebAssembly module
 * @example
 * var compatibleModule;
 * if (typeof WebAssembly !== 'undefined') {
 *     // ... wasmModule ...
 *     compatibleModule = WebAssemblyModule;
 * }
 * else {
 *     // .. jsModule ...
 *     compatibleModule = function() {};
 *     compatibleModule.prototype.exports = exports;
 * }
 * module.exports = comptaibleModule;
 * @returns {string} module string
 */
function createCompatibleModule(jsModule, wasmModule) {
    var module = "var compatibleModule;\n        if (typeof WebAssembly !== 'undefined') {\n            " + wasmModule + "\n            compatibleModule = WebAssemblyModule;\n        }\n        else {\n            " + jsModule + "\n            compatibleModule = function() {};\n            compatibleModule.prototype.exports = exports;\n        }\n        module.exports = compatibleModule;";
    return module;
}
/**
 * Webpack loader for assemblyscript to transform wasm and bundle it
 * @param {string} source - assemblyscript source file
 * @returns {string} module string
 */
function AssemblyScriptLiveLoader(source) {
    var jsModule;
    var wasmModule;
    if (this.cacheable) {
        this.cacheable();
    }
    this.addDependency(wasmFooterPath);
    jsModule = createJsModule(source);
    wasmModule = createWasmModule(source, compile(source));
    return createCompatibleModule(jsModule, wasmModule);
}
exports.default = AssemblyScriptLiveLoader;
