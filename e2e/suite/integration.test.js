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

// e2e/suite/integration.test.ts
var vscode = __toESM(require("vscode"));
var path = __toESM(require("path"));
var fs = __toESM(require("fs"));
var os = __toESM(require("os"));
var assert = __toESM(require("assert"));
var TEST_TIMEOUT = 6e4;
async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
suite("Markly Extension Integration Tests", () => {
  let testFilePath;
  setup(async () => {
    const tempDir = os.tmpdir();
    testFilePath = path.join(tempDir, `markly-int-${Date.now()}.md`);
    fs.writeFileSync(testFilePath, "# Test Document\n\nHello World", "utf-8");
  });
  teardown(async () => {
    if (testFilePath && fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });
  test("Extension should be activated", async () => {
    const extension = vscode.extensions.getExtension("jianmo.markly");
    assert.ok(extension, "Extension should be defined");
    if (!extension.isActive) {
      await extension.activate();
    }
    assert.strictEqual(extension.isActive, true, "Extension should be active");
  }).timeout(TEST_TIMEOUT);
  test("Should open markdown file", async () => {
    const doc = await vscode.workspace.openTextDocument(testFilePath);
    assert.ok(doc, "Document should be defined");
    assert.strictEqual(doc.languageId, "markdown", "Language should be markdown");
    const editor = await vscode.window.showTextDocument(doc);
    assert.ok(editor, "Editor should be defined");
    assert.strictEqual(editor.document.uri.fsPath, doc.uri.fsPath, "Editor should show the correct document");
  }).timeout(TEST_TIMEOUT);
  test("Should toggle mode via modeController", async () => {
    const extension = vscode.extensions.getExtension("jianmo.markly");
    if (!extension?.isActive)
      await extension?.activate();
    const exportsAny = extension?.exports;
    const doc = await vscode.workspace.openTextDocument(testFilePath);
    await vscode.commands.executeCommand("vscode.openWith", doc.uri, "markly.preview");
    await sleep(2e3);
    await vscode.commands.executeCommand("markly.toggleMode");
    await sleep(500);
    const mode = exportsAny?.modeController?.getCurrentMode?.();
    assert.ok(mode === "source" || mode === "preview", `modeController.getCurrentMode() \u5E94\u8FD4\u56DE\u6709\u6548\u503C\uFF0C\u5B9E\u9645: ${String(mode)}`);
  }).timeout(TEST_TIMEOUT);
  test("All registered commands should be available", async () => {
    const commands2 = await vscode.commands.getCommands(true);
    const required = ["markly.toggleMode", "markly.export.pdf", "markly.export.html", "markly.export.image"];
    for (const cmd of required) {
      assert.ok(commands2.includes(cmd), `\u547D\u4EE4 ${cmd} \u5E94\u5DF2\u6CE8\u518C`);
    }
  }).timeout(TEST_TIMEOUT);
});
