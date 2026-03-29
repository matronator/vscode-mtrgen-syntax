import path = require("node:path");

export const DEFAULT_LANGUAGE_ID = "mtrgen";

const HEADER_BLOCK_RE = /^--- MTRGEN ---\r?\n([\s\S]*?)^--- \/MTRGEN ---/m;
const HEADER_FILENAME_RE = /^\s*filename\s*:\s*(.+?)\s*$/m;
const TEMPLATE_TAG_RE = /<%[\s\S]*?%>/g;
const TEMPLATE_COMMENT_RE = /<#([\s\S]*?)#>/g;

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
    { id: "php", extensions: [".php"] },
    { id: "python", extensions: [".py"] },
    { id: "shellscript", extensions: [".sh", ".bash", ".zsh"] },
    { id: "sql", extensions: [".sql"] },
    { id: "java", extensions: [".java"] },
    { id: "csharp", extensions: [".cs"] },
    { id: "go", extensions: [".go"] },
    { id: "rust", extensions: [".rs"] },
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
