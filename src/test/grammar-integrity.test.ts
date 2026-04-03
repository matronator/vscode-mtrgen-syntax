import assert = require("node:assert/strict");
import fs = require("node:fs");
import path = require("node:path");
import test = require("node:test");

interface GrammarContribution {
    path: string;
    scopeName: string;
    language?: string;
    injectTo?: string[];
    embeddedLanguages?: Record<string, string>;
}

interface LanguageContribution {
    id: string;
    extensions?: string[];
    filenames?: string[];
    icon?: {
        light: string;
        dark: string;
    };
}

interface ExtensionPackageJson {
    contributes: {
        configurationDefaults?: {
            "files.associations"?: Record<string, string>;
        };
        languages: LanguageContribution[];
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
const contributedLanguages = packageJson.contributes.languages;
const contributedGrammars = packageJson.contributes.grammars;

function findLanguage(id: string): LanguageContribution | undefined {
    return contributedLanguages.find((language) => language.id === id);
}

function findGrammar(languageId: string): GrammarContribution | undefined {
    return contributedGrammars.find((grammar) => grammar.language === languageId);
}

function findGrammarByScopeName(scopeName: string): GrammarContribution | undefined {
    return contributedGrammars.find((grammar) => grammar.scopeName === scopeName);
}

test("package contributes the MTR language and its grammars", () => {
    assert.equal(contributedLanguages.length, 51);
    assert.equal(contributedGrammars.length, 56);
    assert.ok(findLanguage("mtrgen"));
    assert.ok(findLanguage("mtrgen-php"));
    assert.ok(findLanguage("mtrgen-c"));
    assert.ok(findLanguage("mtrgen-cpp"));
    assert.ok(findLanguage("mtrgen-zig"));
    assert.ok(findLanguage("mtrgen-lua"));
    assert.ok(findLanguage("mtrgen-perl"));
    assert.ok(findLanguage("mtrgen-objective-c"));
    assert.ok(findLanguage("mtrgen-powershell"));
    assert.ok(findLanguage("mtrgen-swift"));
    assert.ok(findLanguage("mtrgen-dart"));
    assert.ok(findLanguage("mtrgen-scala"));
    assert.ok(findLanguage("mtrgen-julia"));
    assert.ok(findLanguage("mtrgen-haskell"));
    assert.ok(findLanguage("mtrgen-erlang"));
    assert.ok(findLanguage("mtrgen-nim"));
    assert.ok(findLanguage("mtrgen-ocaml"));
    assert.ok(findLanguage("mtrgen-lisp"));
    assert.ok(findLanguage("mtrgen-typescriptreact"));
    assert.ok(findLanguage("mtrgen-terraform"));
    assert.ok(findLanguage("mtrgen-solidity"));
    assert.ok(findLanguage("mtrgen-clarity"));
    assert.ok(findLanguage("mtrgen-dockerfile"));
    assert.ok(findGrammar("mtrgen"));
    assert.ok(findGrammar("mtrgen-php"));
    assert.ok(findGrammar("mtrgen-c"));
    assert.ok(findGrammar("mtrgen-cpp"));
    assert.ok(findGrammar("mtrgen-lua"));
    assert.ok(findGrammar("mtrgen-perl"));
    assert.ok(findGrammar("mtrgen-objective-c"));
    assert.ok(findGrammar("mtrgen-powershell"));
    assert.ok(findGrammar("mtrgen-swift"));
    assert.ok(findGrammar("mtrgen-dart"));
    assert.ok(findGrammar("mtrgen-scala"));
    assert.ok(findGrammar("mtrgen-julia"));
    assert.ok(findGrammar("mtrgen-haskell"));
    assert.ok(findGrammar("mtrgen-erlang"));
    assert.ok(findGrammar("mtrgen-nim"));
    assert.ok(findGrammar("mtrgen-ocaml"));
    assert.ok(findGrammar("mtrgen-lisp"));
    assert.ok(findGrammar("mtrgen-typescriptreact"));
    assert.ok(findGrammar("mtrgen-terraform"));
    assert.ok(findGrammar("mtrgen-solidity"));
    assert.ok(findGrammar("mtrgen-dockerfile"));
    assert.deepEqual(findGrammarByScopeName("mtrgen.injection.php")?.injectTo, ["source.mtrgen.php"]);
    assert.deepEqual(findGrammarByScopeName("mtrgen.injection.javascript")?.injectTo, ["source.mtrgen.javascript"]);
    assert.deepEqual(findGrammarByScopeName("mtrgen.injection.typescriptreact")?.injectTo, ["source.mtrgen.typescriptreact"]);
});

test("compound MTR file associations point to dedicated language ids", () => {
    assert.equal(packageJson.contributes.configurationDefaults?.["files.associations"]?.["*.php.mtr"], "mtrgen-php");
    assert.equal(
        packageJson.contributes.configurationDefaults?.["files.associations"]?.["*.js.mtr"],
        "mtrgen-javascript",
    );
    assert.equal(
        packageJson.contributes.configurationDefaults?.["files.associations"]?.["*.tsx.mtr"],
        "mtrgen-typescriptreact",
    );
    assert.equal(
        packageJson.contributes.configurationDefaults?.["files.associations"]?.["Dockerfile.mtr"],
        "mtrgen-dockerfile",
    );
    assert.equal(packageJson.contributes.configurationDefaults?.["files.associations"]?.["*.c.mtr"], "mtrgen-c");
    assert.equal(packageJson.contributes.configurationDefaults?.["files.associations"]?.["*.cpp.mtr"], "mtrgen-cpp");
    assert.equal(packageJson.contributes.configurationDefaults?.["files.associations"]?.["*.zig.mtr"], "mtrgen-zig");
    assert.equal(packageJson.contributes.configurationDefaults?.["files.associations"]?.["*.lua.mtr"], "mtrgen-lua");
    assert.equal(packageJson.contributes.configurationDefaults?.["files.associations"]?.["*.pl.mtr"], "mtrgen-perl");
    assert.equal(packageJson.contributes.configurationDefaults?.["files.associations"]?.["*.m.mtr"], "mtrgen-objective-c");
    assert.equal(packageJson.contributes.configurationDefaults?.["files.associations"]?.["*.scala.mtr"], "mtrgen-scala");
    assert.equal(packageJson.contributes.configurationDefaults?.["files.associations"]?.["*.jl.mtr"], "mtrgen-julia");
    assert.equal(packageJson.contributes.configurationDefaults?.["files.associations"]?.["*.hs.mtr"], "mtrgen-haskell");
    assert.equal(packageJson.contributes.configurationDefaults?.["files.associations"]?.["*.erl.mtr"], "mtrgen-erlang");
    assert.equal(packageJson.contributes.configurationDefaults?.["files.associations"]?.["*.nim.mtr"], "mtrgen-nim");
    assert.equal(packageJson.contributes.configurationDefaults?.["files.associations"]?.["*.ml.mtr"], "mtrgen-ocaml");
    assert.equal(packageJson.contributes.configurationDefaults?.["files.associations"]?.["*.ps1.mtr"], "mtrgen-powershell");
    assert.equal(packageJson.contributes.configurationDefaults?.["files.associations"]?.["*.lisp.mtr"], "mtrgen-lisp");
    assert.equal(packageJson.contributes.configurationDefaults?.["files.associations"]?.["*.swift.mtr"], "mtrgen-swift");
    assert.equal(packageJson.contributes.configurationDefaults?.["files.associations"]?.["*.dart.mtr"], "mtrgen-dart");
    assert.equal(packageJson.contributes.configurationDefaults?.["files.associations"]?.["*.tf.mtr"], "mtrgen-terraform");
    assert.equal(packageJson.contributes.configurationDefaults?.["files.associations"]?.["*.sol.mtr"], "mtrgen-solidity");
    assert.equal(packageJson.contributes.configurationDefaults?.["files.associations"]?.["*.clar.mtr"], "mtrgen-clarity");
});

test("package pins *.mtr files to the MTRGen language and icon", () => {
    assert.equal(packageJson.contributes.configurationDefaults?.["files.associations"]?.["*.mtr"], "mtrgen");
    assert.equal(findLanguage("mtrgen")?.icon?.light, "./images/mtrgen-icon.svg");
    assert.equal(findLanguage("mtrgen-php")?.icon?.light, "./images/mtrgen-icon.svg");
    assert.equal(findLanguage("mtrgen-typescript")?.icon?.light, "./images/mtrgen-icon.svg");
    assert.equal(findLanguage("mtrgen-dockerfile")?.icon?.light, "./images/mtrgen-icon.svg");
});

test("host-aware MTR grammars declare embedded languages", () => {
    assert.equal(findGrammar("mtrgen-php")?.embeddedLanguages?.["text.html.php"], "php");
    assert.equal(findGrammar("mtrgen-javascript")?.embeddedLanguages?.["source.js"], "javascript");
    assert.equal(findGrammar("mtrgen-c")?.embeddedLanguages?.["source.c"], "c");
    assert.equal(findGrammar("mtrgen-cpp")?.embeddedLanguages?.["source.cpp"], "cpp");
    assert.equal(findGrammar("mtrgen-lua")?.embeddedLanguages?.["source.lua"], "lua");
    assert.equal(findGrammar("mtrgen-perl")?.embeddedLanguages?.["source.perl"], "perl");
    assert.equal(findGrammar("mtrgen-objective-c")?.embeddedLanguages?.["source.objc"], "objective-c");
    assert.equal(findGrammar("mtrgen-scala")?.embeddedLanguages?.["source.scala"], "scala");
    assert.equal(findGrammar("mtrgen-julia")?.embeddedLanguages?.["source.julia"], "julia");
    assert.equal(findGrammar("mtrgen-haskell")?.embeddedLanguages?.["source.haskell"], "haskell");
    assert.equal(findGrammar("mtrgen-erlang")?.embeddedLanguages?.["source.erlang"], "erlang");
    assert.equal(findGrammar("mtrgen-nim")?.embeddedLanguages?.["source.nim"], "nim");
    assert.equal(findGrammar("mtrgen-ocaml")?.embeddedLanguages?.["source.ocaml"], "ocaml");
    assert.equal(findGrammar("mtrgen-powershell")?.embeddedLanguages?.["source.powershell"], "powershell");
    assert.equal(findGrammar("mtrgen-lisp")?.embeddedLanguages?.["source.lisp"], "lisp");
    assert.equal(findGrammar("mtrgen-swift")?.embeddedLanguages?.["source.swift"], "swift");
    assert.equal(findGrammar("mtrgen-dart")?.embeddedLanguages?.["source.dart"], "dart");
    assert.equal(findGrammar("mtrgen-typescriptreact")?.embeddedLanguages?.["source.tsx"], "typescriptreact");
    assert.equal(findGrammar("mtrgen-terraform")?.embeddedLanguages?.["source.hcl.terraform"], "terraform");
    assert.equal(findGrammar("mtrgen-solidity")?.embeddedLanguages?.["source.solidity"], "solidity");
    assert.equal(findGrammar("mtrgen-dockerfile")?.embeddedLanguages?.["source.dockerfile"], "dockerfile");
});

test("generated compound language entries include representative compound extensions", () => {
    assert.deepEqual(findLanguage("mtrgen-javascriptreact")?.extensions, [".jsx.mtr"]);
    assert.deepEqual(findLanguage("mtrgen-c")?.extensions, [".c.mtr", ".i.mtr"]);
    assert.deepEqual(
        findLanguage("mtrgen-cpp")?.extensions,
        [".cpp.mtr", ".cppm.mtr", ".cc.mtr", ".ccm.mtr", ".cxx.mtr", ".cxxm.mtr", ".hpp.mtr", ".hh.mtr", ".hxx.mtr", ".ipp.mtr", ".ixx.mtr", ".tpp.mtr", ".txx.mtr"],
    );
    assert.deepEqual(findLanguage("mtrgen-typescript")?.extensions, [".ts.mtr", ".mts.mtr", ".cts.mtr"]);
    assert.deepEqual(findLanguage("mtrgen-lua")?.extensions, [".lua.mtr"]);
    assert.deepEqual(findLanguage("mtrgen-perl")?.extensions, [".pl.mtr", ".pm.mtr", ".pod.mtr", ".t.mtr", ".psgi.mtr"]);
    assert.deepEqual(findLanguage("mtrgen-objective-c")?.extensions, [".m.mtr"]);
    assert.deepEqual(findLanguage("mtrgen-scala")?.extensions, [".scala.mtr", ".sc.mtr"]);
    assert.deepEqual(findLanguage("mtrgen-julia")?.extensions, [".jl.mtr"]);
    assert.deepEqual(findLanguage("mtrgen-haskell")?.extensions, [".hs.mtr", ".lhs.mtr"]);
    assert.deepEqual(findLanguage("mtrgen-erlang")?.extensions, [".erl.mtr", ".hrl.mtr"]);
    assert.deepEqual(findLanguage("mtrgen-nim")?.extensions, [".nim.mtr", ".nimble.mtr"]);
    assert.deepEqual(findLanguage("mtrgen-ocaml")?.extensions, [".ml.mtr", ".mli.mtr", ".mll.mtr", ".mly.mtr"]);
    assert.deepEqual(findLanguage("mtrgen-powershell")?.extensions, [".ps1.mtr", ".psm1.mtr", ".psd1.mtr", ".pssc.mtr", ".psrc.mtr"]);
    assert.deepEqual(findLanguage("mtrgen-lisp")?.extensions, [".lisp.mtr", ".lsp.mtr", ".cl.mtr"]);
    assert.deepEqual(findLanguage("mtrgen-swift")?.extensions, [".swift.mtr"]);
    assert.deepEqual(findLanguage("mtrgen-dart")?.extensions, [".dart.mtr"]);
    assert.deepEqual(findLanguage("mtrgen-terraform")?.extensions, [".tf.mtr", ".tfvars.mtr", ".hcl.mtr"]);
    assert.deepEqual(findLanguage("mtrgen-kotlin")?.extensions, [".kt.mtr", ".kts.mtr"]);
    assert.deepEqual(findLanguage("mtrgen-xml")?.extensions, [".xml.mtr", ".svg.mtr", ".xsd.mtr", ".xsl.mtr"]);
    assert.deepEqual(findLanguage("mtrgen-dockerfile")?.filenames, ["Dockerfile.mtr"]);
});

test("every contributed grammar file exists and contains valid JSON", () => {
    for (const grammar of packageJson.contributes.grammars) {
        const grammarPath = path.join(extensionDir, grammar.path);
        assert.ok(fs.existsSync(grammarPath), `Missing grammar file: ${grammar.path}`);
        const parsed = JSON.parse(fs.readFileSync(grammarPath, "utf8")) as { scopeName: string };
        assert.equal(parsed.scopeName, grammar.scopeName, `Unexpected scopeName in ${grammar.path}`);
    }
});

test("the contributed language icon file exists", () => {
    const iconPath = path.join(extensionDir, "images", "mtrgen-icon.svg");
    assert.ok(fs.existsSync(iconPath), "Missing language icon file: ./images/mtrgen-icon.svg");
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
