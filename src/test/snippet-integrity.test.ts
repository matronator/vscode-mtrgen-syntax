import assert = require("node:assert/strict");
import fs = require("node:fs");
import path = require("node:path");
import test = require("node:test");

function resolveProjectRoot(): string {
    const candidates = [path.resolve(__dirname, ".."), path.resolve(__dirname, "../..")];

    for (const candidate of candidates) {
        if (fs.existsSync(path.join(candidate, "package.json"))) {
            return candidate;
        }
    }

    throw new Error("Unable to resolve the extension root from the test directory.");
}

const extensionDir = resolveProjectRoot();
const snippetsPath = path.join(extensionDir, "snippets", "snippets.code-snippets");

test("snippet definitions do not mix placeholder defaults with snippet variables", () => {
    const snippets = fs.readFileSync(snippetsPath, "utf8");

    assert.doesNotMatch(snippets, /\$\{\d+:\$[A-Z_][A-Z0-9_]*\}/);
});
