import fs = require("node:fs");
import path = require("node:path");

interface CaptureGroup {
    name: string;
}

type CaptureMap = Record<number, CaptureGroup>;

interface IncludePattern {
    include: string;
}

interface MatchPattern {
    match: string;
    name?: string;
    captures?: CaptureMap;
}

interface BeginEndPattern {
    name?: string;
    contentName?: string;
    begin: string;
    beginCaptures?: CaptureMap;
    end: string;
    endCaptures?: CaptureMap;
    patterns?: Pattern[];
}

interface PatternCollection {
    patterns: Pattern[];
}

type Pattern = IncludePattern | MatchPattern | BeginEndPattern | PatternCollection;

interface Grammar {
    $schema: string;
    name: string;
    scopeName: string;
    patterns: IncludePattern[];
    repository: Record<string, Pattern>;
}

interface InjectionGrammar {
    $schema: string;
    scopeName: string;
    injectionSelector: string;
    patterns: IncludePattern[];
}

interface HostLanguageSpec {
    id: string;
    displayName: string;
    grammarScopeName: string;
    hostScopeName: string;
}

const controlKeywords = [
    "if",
    "elseif",
    "else",
    "endif",
    "for",
    "endfor",
    "first",
    "last",
    "sep",
    "empty",
    "endfirst",
    "endlast",
    "endsep",
    "endempty",
] as const;

const HOST_LANGUAGE_SPECS: readonly HostLanguageSpec[] = [
    { id: "php", displayName: "PHP", grammarScopeName: "source.mtrgen.php", hostScopeName: "text.html.php" },
    { id: "javascript", displayName: "JavaScript", grammarScopeName: "source.mtrgen.javascript", hostScopeName: "source.js" },
    {
        id: "javascriptreact",
        displayName: "JavaScript React",
        grammarScopeName: "source.mtrgen.javascriptreact",
        hostScopeName: "source.js.jsx",
    },
    { id: "typescript", displayName: "TypeScript", grammarScopeName: "source.mtrgen.typescript", hostScopeName: "source.ts" },
    {
        id: "typescriptreact",
        displayName: "TypeScript React",
        grammarScopeName: "source.mtrgen.typescriptreact",
        hostScopeName: "source.tsx",
    },
    { id: "json", displayName: "JSON", grammarScopeName: "source.mtrgen.json", hostScopeName: "source.json" },
    { id: "jsonc", displayName: "JSONC", grammarScopeName: "source.mtrgen.jsonc", hostScopeName: "source.json.comments" },
    { id: "html", displayName: "HTML", grammarScopeName: "source.mtrgen.html", hostScopeName: "text.html.basic" },
    { id: "css", displayName: "CSS", grammarScopeName: "source.mtrgen.css", hostScopeName: "source.css" },
    { id: "scss", displayName: "SCSS", grammarScopeName: "source.mtrgen.scss", hostScopeName: "source.css.scss" },
    { id: "less", displayName: "Less", grammarScopeName: "source.mtrgen.less", hostScopeName: "source.css.less" },
    {
        id: "markdown",
        displayName: "Markdown",
        grammarScopeName: "source.mtrgen.markdown",
        hostScopeName: "text.html.markdown",
    },
    { id: "yaml", displayName: "YAML", grammarScopeName: "source.mtrgen.yaml", hostScopeName: "source.yaml" },
    { id: "python", displayName: "Python", grammarScopeName: "source.mtrgen.python", hostScopeName: "source.python" },
    {
        id: "shellscript",
        displayName: "Shell Script",
        grammarScopeName: "source.mtrgen.shellscript",
        hostScopeName: "source.shell",
    },
    { id: "sql", displayName: "SQL", grammarScopeName: "source.mtrgen.sql", hostScopeName: "source.sql" },
    { id: "java", displayName: "Java", grammarScopeName: "source.mtrgen.java", hostScopeName: "source.java" },
    { id: "csharp", displayName: "C#", grammarScopeName: "source.mtrgen.csharp", hostScopeName: "source.cs" },
    { id: "c", displayName: "C", grammarScopeName: "source.mtrgen.c", hostScopeName: "source.c" },
    { id: "cpp", displayName: "C++", grammarScopeName: "source.mtrgen.cpp", hostScopeName: "source.cpp" },
    { id: "go", displayName: "Go", grammarScopeName: "source.mtrgen.go", hostScopeName: "source.go" },
    { id: "zig", displayName: "Zig", grammarScopeName: "source.mtrgen.zig", hostScopeName: "source.zig" },
    { id: "odin", displayName: "Odin", grammarScopeName: "source.mtrgen.odin", hostScopeName: "source.odin" },
    { id: "gleam", displayName: "Gleam", grammarScopeName: "source.mtrgen.gleam", hostScopeName: "source.gleam" },
    { id: "kdl", displayName: "KDL", grammarScopeName: "source.mtrgen.kdl", hostScopeName: "source.kdl" },
    { id: "haxe", displayName: "Haxe", grammarScopeName: "source.mtrgen.haxe", hostScopeName: "source.haxe" },
    { id: "elm", displayName: "Elm", grammarScopeName: "source.mtrgen.elm", hostScopeName: "source.elm" },
    { id: "elixir", displayName: "Elixir", grammarScopeName: "source.mtrgen.elixir", hostScopeName: "source.elixir" },
    { id: "ruby", displayName: "Ruby", grammarScopeName: "source.mtrgen.ruby", hostScopeName: "source.ruby" },
    { id: "toml", displayName: "TOML", grammarScopeName: "source.mtrgen.toml", hostScopeName: "source.toml" },
    {
        id: "terraform",
        displayName: "Terraform",
        grammarScopeName: "source.mtrgen.terraform",
        hostScopeName: "source.hcl.terraform",
    },
    { id: "kotlin", displayName: "Kotlin", grammarScopeName: "source.mtrgen.kotlin", hostScopeName: "source.kotlin" },
    { id: "rust", displayName: "Rust", grammarScopeName: "source.mtrgen.rust", hostScopeName: "source.rust" },
    { id: "solidity", displayName: "Solidity", grammarScopeName: "source.mtrgen.solidity", hostScopeName: "source.solidity" },
    { id: "clarity", displayName: "Clarity", grammarScopeName: "source.mtrgen.clarity", hostScopeName: "source.clarity" },
    { id: "xml", displayName: "XML", grammarScopeName: "source.mtrgen.xml", hostScopeName: "text.xml" },
    {
        id: "dockerfile",
        displayName: "Dockerfile",
        grammarScopeName: "source.mtrgen.dockerfile",
        hostScopeName: "source.dockerfile",
    },
] as const;

function resolveProjectRoot(): string {
    const candidates = [path.resolve(__dirname, ".."), path.resolve(__dirname, "../..")];

    for (const candidate of candidates) {
        if (fs.existsSync(path.join(candidate, "package.json"))) {
            return candidate;
        }
    }

    throw new Error("Unable to resolve the extension root from the grammar generator script.");
}

const extensionDir = resolveProjectRoot();
const syntaxesDir = path.join(extensionDir, "syntaxes");

function createRepository(): Record<string, Pattern> {
    return {
        header: {
            name: "comment.block.mtrgen.header",
            begin: "^(--- MTRGEN ---)\\s*$",
            beginCaptures: {
                1: { name: "punctuation.definition.comment.begin.mtrgen.header" },
            },
            end: "^(--- \\/MTRGEN ---)\\s*$",
            endCaptures: {
                1: { name: "punctuation.definition.comment.end.mtrgen.header" },
            },
            patterns: [
                { include: "#headerField" },
                { include: "#templateComment" },
                { include: "#templateTag" },
                { match: "^.*$", name: "comment.block.mtrgen.header" },
            ],
        },
        headerField: {
            match: "^(\\s*)([A-Za-z_][\\w-]*)(\\s*:)",
            captures: {
                1: { name: "comment.block.mtrgen.header" },
                2: { name: "entity.other.attribute-name.mtrgen.header" },
                3: { name: "punctuation.separator.key-value.mtrgen.header" },
            },
        },
        templateComment: {
            name: "comment.block.mtrgen.template",
            begin: "<#",
            beginCaptures: {
                0: { name: "punctuation.definition.comment.begin.mtrgen.template" },
            },
            end: "#>",
            endCaptures: {
                0: { name: "punctuation.definition.comment.end.mtrgen.template" },
            },
        },
        templateTag: {
            name: "meta.embedded.block.mtrgen",
            contentName: "source.mtrgen.tag",
            begin: "<%",
            beginCaptures: {
                0: { name: "punctuation.section.embedded.begin.mtrgen" },
            },
            end: "%>",
            endCaptures: {
                0: { name: "punctuation.section.embedded.end.mtrgen" },
            },
            patterns: [
                { include: "#strings" },
                { include: "#filters" },
                { include: "#keywords" },
                { include: "#variables" },
                { include: "#constants" },
                { include: "#operators" },
                { include: "#punctuation" },
                { include: "#identifiers" },
            ],
        },
        strings: {
            patterns: [
                {
                    name: "string.quoted.double.mtrgen",
                    begin: "\"",
                    end: "\"",
                    patterns: [
                        {
                            match: "\\\\.",
                            name: "constant.character.escape.mtrgen",
                        },
                    ],
                },
                {
                    name: "string.quoted.single.mtrgen",
                    begin: "'",
                    end: "'",
                    patterns: [
                        {
                            match: "\\\\.",
                            name: "constant.character.escape.mtrgen",
                        },
                    ],
                },
            ],
        },
        filters: {
            match: "(\\|)([A-Za-z_][\\w-]*)",
            captures: {
                1: { name: "keyword.operator.pipe.mtrgen" },
                2: { name: "entity.name.function.mtrgen.filter" },
            },
        },
        keywords: {
            patterns: [
                {
                    match: `(?<![\\w$-])(?:${controlKeywords.map(escapeForRegex).join("|")})(?![\\w-])`,
                    name: "keyword.control.mtrgen",
                },
                {
                    match: "\\bof\\b",
                    name: "keyword.operator.word.mtrgen",
                },
            ],
        },
        variables: {
            match: "\\$[A-Za-z_][\\w]*",
            name: "variable.other.readwrite.mtrgen",
        },
        constants: {
            patterns: [
                {
                    match: "\\b(?:true|false|null)\\b",
                    name: "constant.language.mtrgen",
                },
                {
                    match: "(?<![\\w.])-?\\d+(?:\\.\\d+)?\\b",
                    name: "constant.numeric.mtrgen",
                },
            ],
        },
        operators: {
            match: "===|!==|==|!=|<=|>=|&&|\\|\\||[<>!=]",
            name: "keyword.operator.mtrgen",
        },
        punctuation: {
            match: "[\\[\\](){},.:]",
            name: "punctuation.separator.mtrgen",
        },
        identifiers: {
            match: "\\b[A-Za-z_][\\w-]*\\b",
            name: "variable.parameter.mtrgen",
        },
    };
}

function createGrammar({ name, scopeName }: { name: string; scopeName: string }): Grammar {
    const patterns: IncludePattern[] = [
        { include: "#header" },
        { include: "#templateComment" },
        { include: "#templateTag" },
    ];

    return {
        $schema: "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
        name,
        scopeName,
        patterns,
        repository: createRepository(),
    };
}

function createHostGrammar({
    name,
    scopeName,
    hostScopeName,
}: {
    name: string;
    scopeName: string;
    hostScopeName: string;
}): Grammar {
    const patterns: IncludePattern[] = [
        { include: "#header" },
        { include: "#templateComment" },
        { include: "#templateTag" },
        { include: hostScopeName },
    ];

    return {
        $schema: "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
        name,
        scopeName,
        patterns,
        repository: createRepository(),
    };
}

function createInjectionGrammar(scopeName: string, injectionSelector: string): InjectionGrammar {
    return {
        $schema: "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
        scopeName,
        injectionSelector,
        patterns: [{ include: "source.mtrgen" }],
    };
}

function writeJson(filePath: string, value: unknown): void {
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function escapeForRegex(value: string): string {
    return value.replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&");
}

fs.mkdirSync(syntaxesDir, { recursive: true });

for (const entry of fs.readdirSync(syntaxesDir)) {
    if (!entry.startsWith("mtrgen-") || !entry.endsWith(".tmLanguage.json")) {
        continue;
    }

    fs.unlinkSync(path.join(syntaxesDir, entry));
}

writeJson(
    path.join(syntaxesDir, "mtrgen.tmLanguage.json"),
    createGrammar({
        name: "MTRGen",
        scopeName: "source.mtrgen",
    }),
);

for (const hostLanguage of HOST_LANGUAGE_SPECS) {
    writeJson(
        path.join(syntaxesDir, `mtrgen.${hostLanguage.id}.tmLanguage.json`),
        createHostGrammar({
            name: `MTRGen (${hostLanguage.displayName})`,
            scopeName: hostLanguage.grammarScopeName,
            hostScopeName: hostLanguage.hostScopeName,
        }),
    );
}

writeJson(
    path.join(syntaxesDir, "mtrgen.javascript.injection.tmLanguage.json"),
    createInjectionGrammar("mtrgen.injection.javascript", "L:source.js"),
);

writeJson(
    path.join(syntaxesDir, "mtrgen.javascriptreact.injection.tmLanguage.json"),
    createInjectionGrammar("mtrgen.injection.javascriptreact", "L:source.js.jsx"),
);

writeJson(
    path.join(syntaxesDir, "mtrgen.typescript.injection.tmLanguage.json"),
    createInjectionGrammar("mtrgen.injection.typescript", "L:source.ts"),
);

writeJson(
    path.join(syntaxesDir, "mtrgen.typescriptreact.injection.tmLanguage.json"),
    createInjectionGrammar("mtrgen.injection.typescriptreact", "L:source.tsx"),
);
