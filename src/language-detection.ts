import path = require("node:path");

export const DEFAULT_LANGUAGE_ID = "mtrgen";

const HEADER_BLOCK_RE = /^--- MTRGEN ---\r?\n([\s\S]*?)^--- \/MTRGEN ---/m;
const HEADER_FILENAME_RE = /^\s*filename\s*:\s*(.+?)\s*$/m;
const TEMPLATE_TAG_RE = /<%[\s\S]*?%>/g;
const TEMPLATE_COMMENT_RE = /<#([\s\S]*?)#>/g;
const HEADER_MARKER_RE = /^--- MTRGEN ---\s*$/m;
const TEMPLATE_TAG_MARKER_RE = /<%[\s\S]*?%>/;
const TEMPLATE_COMMENT_MARKER_RE = /<#([\s\S]*?)#>/;
const MTR_VARIABLE_RE = /\$[A-Za-z_][\w]*/;
const FILTER_PIPE_RE = /\|\s*[A-Za-z_][\w-]*/;
const CONTROL_TAG_RE =
    /<%\s*(?:if|elseif|else|endif|for|endfor|first|last|sep|empty|endfirst|endlast|endsep|endempty|of)\b/;

export interface LanguageContribution {
    id?: string;
    languageId?: string;
    extensions?: readonly string[];
    filenames?: readonly string[];
}

interface LanguageRegistryEntry {
    suffix: string;
    languageId: string;
    order: number;
}

export interface LanguageRegistry {
    extensionEntries: LanguageRegistryEntry[];
    filenameMap: Map<string, string>;
}

export const FALLBACK_LANGUAGE_SPECS = [
    { id: "javascript", extensions: [".js", ".mjs", ".cjs", ".es6"] },
    { id: "javascriptreact", extensions: [".jsx"] },
    { id: "typescript", extensions: [".ts", ".mts", ".cts"] },
    { id: "typescriptreact", extensions: [".tsx"] },
    { id: "json", extensions: [".json", ".jsonc"] },
    { id: "html", extensions: [".html", ".htm"] },
    { id: "css", extensions: [".css"] },
    { id: "scss", extensions: [".scss", ".sass"] },
    { id: "less", extensions: [".less"] },
    { id: "markdown", extensions: [".md", ".markdown"] },
    { id: "yaml", extensions: [".yaml", ".yml"] },
    { id: "php", extensions: [".php", ".phpt"] },
    { id: "python", extensions: [".py"] },
    { id: "shellscript", extensions: [".sh", ".bash", ".zsh"] },
    { id: "sql", extensions: [".sql"] },
    { id: "java", extensions: [".java"] },
    { id: "csharp", extensions: [".cs"] },
    { id: "c", extensions: [".c", ".i"] },
    { id: "cpp", extensions: [".cpp", ".cppm", ".cc", ".ccm", ".cxx", ".cxxm", ".hpp", ".hh", ".hxx", ".ipp", ".ixx", ".tpp", ".txx"] },
    { id: "go", extensions: [".go"] },
    { id: "zig", extensions: [".zig"] },
    { id: "odin", extensions: [".odin"] },
    { id: "gleam", extensions: [".gleam"] },
    { id: "kdl", extensions: [".kdl"] },
    { id: "haxe", extensions: [".hx"] },
    { id: "elm", extensions: [".elm"] },
    { id: "elixir", extensions: [".ex", ".exs"] },
    { id: "ruby", extensions: [".rb", ".rbx", ".rjs", ".gemspec", ".rake", ".ru", ".erb", ".podspec", ".rbi"] },
    { id: "toml", extensions: [".toml"] },
    { id: "terraform", extensions: [".tf", ".tfvars", ".hcl"] },
    { id: "kotlin", extensions: [".kt", ".kts"] },
    { id: "rust", extensions: [".rs"] },
    { id: "swift", extensions: [".swift"] },
    { id: "dart", extensions: [".dart"] },
    { id: "lua", extensions: [".lua"] },
    { id: "perl", extensions: [".pl", ".pm", ".pod", ".t", ".PL", ".psgi"] },
    { id: "objective-c", extensions: [".m"] },
    { id: "scala", extensions: [".scala", ".sc"] },
    { id: "julia", extensions: [".jl"] },
    { id: "haskell", extensions: [".hs", ".lhs"] },
    { id: "erlang", extensions: [".erl", ".hrl"] },
    { id: "nim", extensions: [".nim", ".nimble"] },
    { id: "ocaml", extensions: [".ml", ".mli", ".mll", ".mly"] },
    { id: "powershell", extensions: [".ps1", ".psm1", ".psd1", ".pssc", ".psrc"] },
    { id: "lisp", extensions: [".lisp", ".lsp", ".cl"] },
    { id: "solidity", extensions: [".sol"] },
    { id: "clarity", extensions: [".clar"] },
    { id: "xml", extensions: [".xml", ".svg", ".xsd", ".xsl"] },
] satisfies readonly LanguageContribution[];

function toArray<T>(value: readonly T[] | null | undefined): readonly T[] {
    return Array.isArray(value) ? value : [];
}

function normalizeCandidate(value: string | null | undefined): string | null {
    if (!value) {
        return null;
    }

    const normalized = value.trim().replace(/\\/g, "/");
    if (!normalized) {
        return null;
    }

    const basename = path.posix.basename(normalized).toLowerCase();
    return basename || null;
}

export function createLanguageRegistry(
    languageSpecs: readonly LanguageContribution[] = FALLBACK_LANGUAGE_SPECS,
): LanguageRegistry {
    const extensionEntries: LanguageRegistryEntry[] = [];
    const filenameMap = new Map<string, string>();
    let order = 0;

    for (const spec of languageSpecs) {
        const languageId = spec.languageId ?? spec.id;
        if (!languageId || languageId === DEFAULT_LANGUAGE_ID) {
            continue;
        }

        for (const extension of toArray(spec.extensions)) {
            if (!extension.startsWith(".")) {
                continue;
            }

            extensionEntries.push({
                suffix: extension.toLowerCase(),
                languageId,
                order,
            });
        }

        for (const filename of toArray(spec.filenames)) {
            const normalized = filename.trim().toLowerCase();
            if (!normalized || filenameMap.has(normalized)) {
                continue;
            }

            filenameMap.set(normalized, languageId);
        }

        order += 1;
    }

    extensionEntries.sort((left, right) => {
        if (right.suffix.length !== left.suffix.length) {
            return right.suffix.length - left.suffix.length;
        }

        return left.order - right.order;
    });

    return {
        extensionEntries,
        filenameMap,
    };
}

export const DEFAULT_LANGUAGE_REGISTRY = createLanguageRegistry();

export function inferLanguageId(
    candidate: string | null | undefined,
    registry: LanguageRegistry = DEFAULT_LANGUAGE_REGISTRY,
): string {
    if (!candidate) {
        return DEFAULT_LANGUAGE_ID;
    }

    const normalized = normalizeCandidate(candidate);
    if (!normalized) {
        return DEFAULT_LANGUAGE_ID;
    }

    const fromFilename = registry.filenameMap.get(normalized);
    if (fromFilename) {
        return fromFilename;
    }

    for (const entry of registry.extensionEntries) {
        if (normalized.endsWith(entry.suffix)) {
            return entry.languageId;
        }
    }

    return DEFAULT_LANGUAGE_ID;
}

export function detectTemplateFilename(fileName: string | null | undefined): string | null {
    if (!fileName || !fileName.toLowerCase().endsWith(".mtr")) {
        return null;
    }

    return normalizeCandidate(fileName.slice(0, -".mtr".length));
}

function sanitizeHeaderFilename(rawValue: string): string {
    return rawValue
        .replace(TEMPLATE_TAG_RE, "")
        .replace(TEMPLATE_COMMENT_RE, "")
        .replace(/^['"]|['"]$/g, "")
        .trim();
}

export function detectHeaderFilename(text: string): string | null {
    const headerMatch = HEADER_BLOCK_RE.exec(text);
    if (!headerMatch) {
        return null;
    }

    const filenameMatch = HEADER_FILENAME_RE.exec(headerMatch[1]);
    if (!filenameMatch) {
        return null;
    }

    const sanitized = sanitizeHeaderFilename(filenameMatch[1]);
    return normalizeCandidate(sanitized);
}

export function detectLanguageId(
    fileName: string | null | undefined,
    text = "",
    registry: LanguageRegistry = DEFAULT_LANGUAGE_REGISTRY,
): string {
    const explicitLanguageId = inferLanguageId(detectTemplateFilename(fileName), registry);
    if (explicitLanguageId !== DEFAULT_LANGUAGE_ID) {
        return explicitLanguageId;
    }

    return inferLanguageId(detectHeaderFilename(text), registry);
}

export function detectDocumentLanguageId(
    fileName: string | null | undefined,
    text = "",
    registry: LanguageRegistry = DEFAULT_LANGUAGE_REGISTRY,
): string {
    if (fileName?.toLowerCase().endsWith(".mtr")) {
        return DEFAULT_LANGUAGE_ID;
    }

    const explicitLanguageId = inferLanguageId(fileName, registry);
    if (explicitLanguageId !== DEFAULT_LANGUAGE_ID) {
        return explicitLanguageId;
    }

    return detectLanguageId(fileName, text, registry);
}

export function looksLikeMtrText(text: string): boolean {
    if (HEADER_MARKER_RE.test(text)) {
        return true;
    }

    if (TEMPLATE_COMMENT_MARKER_RE.test(text)) {
        return true;
    }

    if (!TEMPLATE_TAG_MARKER_RE.test(text)) {
        return false;
    }

    return MTR_VARIABLE_RE.test(text) || FILTER_PIPE_RE.test(text) || CONTROL_TAG_RE.test(text);
}
