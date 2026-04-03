"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// e2e/suite/extension.test.ts
var assert = __toESM(require("assert"));
var vscode = __toESM(require("vscode"));
suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");
  test("Extension should be present", () => {
    const extension = vscode.extensions.getExtension("jianmo.markly");
    assert.ok(extension, "Extension should be installed");
  });
  test("Extension should be activated", async () => {
    const extension = vscode.extensions.getExtension("jianmo.markly");
    assert.ok(extension, "Extension should be installed");
    if (!extension.isActive) {
      await extension.activate();
    }
    assert.strictEqual(extension.isActive, true, "Extension should be activated");
  });
  test("Sample test", () => {
    assert.strictEqual([1, 2, 3].indexOf(5), -1);
    assert.strictEqual([1, 2, 3].indexOf(0), -1);
  });
});
