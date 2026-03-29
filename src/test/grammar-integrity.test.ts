import assert = require("node:assert/strict");
import fs = require("node:fs");
import path = require("node:path");
import test = require("node:test");

interface GrammarContribution {
    language: string;
    path: string;
    scopeName: string;
}

interface ExtensionPackageJson {
    contributes: {
        languages: Array<{ id: string }>;
        grammars: GrammarContribution[];
    };
}

function resolveProjectRoot(): string {
    const candidates = [path.resolve(__dirname, ".."), path.resolve(__dirname, "../..")];

    for (const candidate of candidates) {
        if (fs.existsSync(path.join(candidate, "package.json"))) {
            return candidate;
        }
    }

    throw new Error("Unable to resolve the extension root from the test directory.");
}

function readPackageJson(extensionDir: string): ExtensionPackageJson {
    return JSON.parse(fs.readFileSync(path.join(extensionDir, "package.json"), "utf8")) as ExtensionPackageJson;
}

const extensionDir = resolveProjectRoot();
const packageJson = readPackageJson(extensionDir);

test("package contributes a single generic MTR language and grammar", () => {
    assert.equal(packageJson.contributes.languages.length, 1);
    assert.equal(packageJson.contributes.languages[0].id, "mtrgen");
    assert.equal(packageJson.contributes.grammars.length, 1);
    assert.equal(packageJson.contributes.grammars[0].language, "mtrgen");
});

test("every contributed grammar file exists and contains valid JSON", () => {
    for (const grammar of packageJson.contributes.grammars) {
        const grammarPath = path.join(extensionDir, grammar.path);
        assert.ok(fs.existsSync(grammarPath), `Missing grammar file: ${grammar.path}`);
        const parsed = JSON.parse(fs.readFileSync(grammarPath, "utf8")) as { scopeName: string };
        assert.equal(parsed.scopeName, grammar.scopeName, `Unexpected scopeName in ${grammar.path}`);
    }
});

test("generated grammars do not include legacy loop block syntax", () => {
    const legacyTokens = ["!first", "!last", "!sep", "!empty", "/first", "/last", "/sep", "/empty"];

    for (const grammar of packageJson.contributes.grammars) {
        const grammarPath = path.join(extensionDir, grammar.path);
        const raw = fs.readFileSync(grammarPath, "utf8");

        for (const token of legacyTokens) {
            assert.equal(raw.includes(token), false, `Found legacy token ${token} in ${grammar.path}`);
        }
    }
});
