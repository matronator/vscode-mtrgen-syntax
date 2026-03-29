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
