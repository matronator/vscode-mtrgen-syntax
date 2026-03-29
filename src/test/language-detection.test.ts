import assert = require("node:assert/strict");
import test = require("node:test");

import {
    DEFAULT_LANGUAGE_ID,
    createLanguageRegistry,
    detectHeaderFilename,
    detectLanguageId,
    detectTemplateFilename,
    inferLanguageId,
} from "../language-detection";

const registry = createLanguageRegistry([
    { id: "clarity", extensions: [".clar"] },
    { id: "cpp", extensions: [".cpp", ".hpp"] },
    { id: "dockerfile", filenames: ["Dockerfile"] },
    { id: "mdx", extensions: [".mdx"] },
    { id: "php", extensions: [".php", ".blade.php"] },
    { id: "zig", extensions: [".zig"] },
]);

test("detects the host language from the template filename", () => {
    assert.equal(detectTemplateFilename("/tmp/token.clar.mtr"), "token.clar");
    assert.equal(detectLanguageId("/tmp/token.clar.mtr", "", registry), "clarity");
    assert.equal(detectLanguageId("/tmp/source.zig.mtr", "", registry), "zig");
});

test("supports longest-suffix matches and filename-only languages", () => {
    assert.equal(inferLanguageId("view.blade.php", registry), "php");
    assert.equal(detectLanguageId("/tmp/Dockerfile.mtr", "", registry), "dockerfile");
});

test("falls back to generic MTR when the filename does not imply a supported language", () => {
    assert.equal(detectLanguageId("/tmp/component.custom.mtr", "", registry), DEFAULT_LANGUAGE_ID);
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

test("registry prefers exact filenames before suffix checks", () => {
    const filenameRegistry = createLanguageRegistry([
        { id: "dotenv", filenames: [".env"] },
        { id: "shellscript", extensions: [".env"] },
    ]);

    assert.equal(inferLanguageId(".env", filenameRegistry), "dotenv");
});
