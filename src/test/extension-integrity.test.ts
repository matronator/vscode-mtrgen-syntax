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
const extensionSourcePath = path.join(extensionDir, "src", "extension.ts");
const packageJsonPath = path.join(extensionDir, "package.json");

test("extension does not reassign VS Code language modes at runtime", () => {
    const source = fs.readFileSync(extensionSourcePath, "utf8");

    assert.doesNotMatch(source, /setTextDocumentLanguage/);
});

test("package contributes the create-from-template command in explorer surfaces", () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
        contributes?: {
            commands?: Array<{ command?: string }>;
            menus?: {
                ["explorer/context"]?: Array<{ command?: string }>;
                ["view/title"]?: Array<{ command?: string }>;
            };
        };
    };

    const commandId = "mtrgenSyntax.createFileFromTemplate";

    assert.ok(packageJson.contributes?.commands?.some((command) => command.command === commandId));
    assert.ok(packageJson.contributes?.menus?.["explorer/context"]?.some((item) => item.command === commandId));
    assert.ok(packageJson.contributes?.menus?.["view/title"]?.some((item) => item.command === commandId));
});
