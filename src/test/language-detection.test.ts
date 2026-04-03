import assert = require("node:assert/strict");
import test = require("node:test");

import {
    DEFAULT_LANGUAGE_ID,
    createLanguageRegistry,
    detectDocumentLanguageId,
    detectHeaderFilename,
    detectLanguageId,
    detectTemplateFilename,
    inferLanguageId,
    looksLikeMtrText,
} from "../language-detection";

const registry = createLanguageRegistry([
    { id: "clarity", extensions: [".clar"] },
    { id: "cpp", extensions: [".cpp", ".hpp"] },
    { id: "dockerfile", filenames: ["Dockerfile"] },
    { id: "elixir", extensions: [".ex", ".exs"] },
    { id: "mdx", extensions: [".mdx"] },
    { id: "php", extensions: [".php", ".blade.php"] },
    { id: "solidity", extensions: [".sol"] },
    { id: "terraform", extensions: [".tf", ".tfvars", ".hcl"] },
    { id: "toml", extensions: [".toml"] },
    { id: "zig", extensions: [".zig"] },
]);

test("detects the host language from the template filename", () => {
    assert.equal(detectTemplateFilename("/tmp/token.clar.mtr"), "token.clar");
    assert.equal(detectLanguageId("/tmp/token.clar.mtr", "", registry), "clarity");
    assert.equal(detectLanguageId("/tmp/infra.tf.mtr", "", registry), "terraform");
    assert.equal(detectLanguageId("/tmp/contract.sol.mtr", "", registry), "solidity");
    assert.equal(detectLanguageId("/tmp/source.zig.mtr", "", registry), "zig");
});

test("supports longest-suffix matches and filename-only languages", () => {
    assert.equal(inferLanguageId("view.blade.php", registry), "php");
    assert.equal(detectLanguageId("/tmp/Dockerfile.mtr", "", registry), "dockerfile");
});

test("falls back to generic MTR when the filename does not imply a supported language", () => {
    assert.equal(detectLanguageId("/tmp/component.custom.mtr", "", registry), DEFAULT_LANGUAGE_ID);
});

test("keeps .mtr files in the MTR language mode", () => {
    assert.equal(detectDocumentLanguageId("/tmp/token.php.mtr", "", registry), DEFAULT_LANGUAGE_ID);
});

test("keeps host-language files in their original language mode", () => {
    const template = `--- MTRGEN ---
name: controller
--- /MTRGEN ---

<?php echo "<% $name %>"; ?>
`;

    assert.equal(detectDocumentLanguageId("/tmp/controller.php", template, registry), "php");
});

test("detects the host language from the MTR header filename field", () => {
    const template = `--- MTRGEN ---
name: component
filename: <% $name|pascalCase %>.mdx
path: src
--- /MTRGEN ---

export const component = "<% $name %>";
`;

    assert.equal(detectHeaderFilename(template), ".mdx");
    assert.equal(detectLanguageId("/tmp/component.mtr", template, registry), "mdx");
});

test("supports quoted or static header filenames", () => {
    const template = `--- MTRGEN ---
name: config
filename: "token.clar"
path: config
--- /MTRGEN ---
`;

    assert.equal(detectHeaderFilename(template), "token.clar");
    assert.equal(detectLanguageId("/tmp/config.mtr", template, registry), "clarity");
});

test("detects newly added host languages from static header filenames", () => {
    const template = `--- MTRGEN ---
name: config
filename: "app.toml"
path: config
--- /MTRGEN ---
`;

    assert.equal(detectHeaderFilename(template), "app.toml");
    assert.equal(detectLanguageId("/tmp/config.mtr", template, registry), "toml");
});

test("registry prefers exact filenames before suffix checks", () => {
    const filenameRegistry = createLanguageRegistry([
        { id: "dotenv", filenames: [".env"] },
        { id: "shellscript", extensions: [".env"] },
    ]);

    assert.equal(inferLanguageId(".env", filenameRegistry), "dotenv");
});

test("detects MTR content in files without a .mtr extension", () => {
    const template = `--- MTRGEN ---
name: Dockerfile
--- /MTRGEN ---

FROM node:20
RUN echo "<% $name %>"
`;

    assert.equal(looksLikeMtrText(template), true);
});

test("does not claim unrelated templates that only share <% %> delimiters", () => {
    const erbLikeTemplate = `<%= title %>\n<p>Hello</p>\n`;

    assert.equal(looksLikeMtrText(erbLikeTemplate), false);
});
