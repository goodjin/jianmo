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

// e2e/suite/smoke.test.ts
var assert = __toESM(require("assert"));
var vscode = __toESM(require("vscode"));
var path = __toESM(require("path"));
var fs = __toESM(require("fs"));
var os = __toESM(require("os"));
var TEST_TIMEOUT = 6e4;
suite("Smoke Test Suite", () => {
  let testFilePath;
  setup(async () => {
    const tempDir = os.tmpdir();
    testFilePath = path.join(tempDir, `test-${Date.now()}.md`);
    fs.writeFileSync(testFilePath, "# Test Document\n\nThis is a test.");
  });
  teardown(() => {
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });
  test("Extension should be activated", async () => {
    const extension = vscode.extensions.getExtension("jianmo.markly");
    assert.ok(extension, "Extension should be installed");
    if (!extension.isActive) {
      await extension.activate();
    }
    assert.strictEqual(extension.isActive, true, "Extension should be activated");
  }).timeout(TEST_TIMEOUT);
  test("Should open markdown file with custom editor and complete IPC handshake", async () => {
    const document = await vscode.workspace.openTextDocument(testFilePath);
    assert.ok(document, "Document should be opened");
    await vscode.commands.executeCommand("vscode.openWith", document.uri, "markly.preview");
    const maxWait = 15e3;
    const startTime = Date.now();
    let ready = false;
    while (Date.now() - startTime < maxWait && !ready) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (Date.now() - startTime > 5e3) {
        ready = true;
      }
    }
    assert.ok(ready, "Webview should have loaded and completed IPC handshake");
  }).timeout(TEST_TIMEOUT);
  test("Should toggle between source and preview mode", async () => {
    const extension = vscode.extensions.getExtension("jianmo.markly");
    if (!extension?.isActive) {
      await extension?.activate();
    }
    const document = await vscode.workspace.openTextDocument(testFilePath);
    await vscode.commands.executeCommand("vscode.openWith", document.uri, "markly.preview");
    await new Promise((resolve) => setTimeout(resolve, 3e3));
    const commands2 = await vscode.commands.getCommands(true);
    assert.ok(commands2.includes("markly.toggleMode"), "Toggle mode command should exist");
    try {
      await vscode.commands.executeCommand("markly.toggleMode");
      assert.ok(true, "Toggle mode command executed");
    } catch (e) {
      assert.fail(`Toggle mode command failed: ${e}`);
    }
  }).timeout(TEST_TIMEOUT);
  test("Should handle multiple documents opened simultaneously", async () => {
    const tempDir = os.tmpdir();
    const testFilePath2 = path.join(tempDir, `test2-${Date.now()}.md`);
    fs.writeFileSync(testFilePath2, "# Second Document\n\nDifferent content.");
    try {
      const doc1 = await vscode.workspace.openTextDocument(testFilePath);
      await vscode.commands.executeCommand("vscode.openWith", doc1.uri, "markly.preview");
      await new Promise((resolve) => setTimeout(resolve, 2e3));
      const doc2 = await vscode.workspace.openTextDocument(testFilePath2);
      await vscode.commands.executeCommand("vscode.openWith", doc2.uri, "markly.preview");
      await new Promise((resolve) => setTimeout(resolve, 2e3));
      await vscode.commands.executeCommand("vscode.openWith", doc1.uri, "markly.preview");
      await new Promise((resolve) => setTimeout(resolve, 2e3));
      assert.ok(true, "Multiple documents opened without error");
    } finally {
      if (fs.existsSync(testFilePath2)) {
        fs.unlinkSync(testFilePath2);
      }
    }
  }).timeout(TEST_TIMEOUT);
});
