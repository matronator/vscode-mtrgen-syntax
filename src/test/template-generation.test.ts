import assert = require("node:assert/strict");
import fs = require("node:fs");
import os = require("node:os");
import path = require("node:path");
import test = require("node:test");

import {
    applyPromptValue,
    extractTemplatePromptFields,
    findAvailableTemplatePath,
    listTemplateFiles,
    resolveGeneratedFilePath,
} from "../template-generation";

test("listTemplateFiles returns sorted recursive template files from .mtrgen", async () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mtrgen-syntax-"));

    try {
        fs.mkdirSync(path.join(workspaceRoot, ".mtrgen", "nested"), { recursive: true });
        fs.writeFileSync(path.join(workspaceRoot, ".mtrgen", "z-last.mtr"), "");
        fs.writeFileSync(path.join(workspaceRoot, ".mtrgen", "nested", "a-first.mtr"), "");
        fs.writeFileSync(path.join(workspaceRoot, ".mtrgen", ".ignored.mtr"), "");

        const templates = await listTemplateFiles(workspaceRoot);

        assert.deepEqual(
            templates.map((template) => template.relativePath),
            ["nested/a-first.mtr", "z-last.mtr"],
        );
    } finally {
        fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
});

test("extractTemplatePromptFields collects defaults and nested references", () => {
    const template = `--- MTRGEN ---
name: component
filename: <% name|pascalCase %>.tsx
path: src/<% meta.folder %>
defaults:
    enabled: true
    count: 3
    meta: {folder: "components"}
--- /MTRGEN ---

export const title = "<% title="Hello" %>";
<% if enabled %>
console.log("<% items[0].label %>");
<% endif %>
<% if count >= minCount %>
<% endif %>
`;

    assert.deepEqual(extractTemplatePromptFields(template), [
        { key: "name" },
        { key: "meta.folder", defaultValue: "components" },
        { key: "title", defaultValue: "Hello" },
        { key: "enabled", defaultValue: true },
        { key: "items[0].label" },
        { key: "count", defaultValue: 3 },
        { key: "minCount" },
    ]);
});

test("applyPromptValue builds nested objects and arrays", () => {
    const values: Record<string, unknown> = {};

    applyPromptValue(values, "meta.folder", "components");
    applyPromptValue(values, "items[0].label", "Button");
    applyPromptValue(values, "items[0].enabled", true);

    assert.deepEqual(values, {
        meta: {
            folder: "components",
        },
        items: [
            {
                enabled: true,
                label: "Button",
            },
        ],
    });
});

test("findAvailableTemplatePath creates unique names inside .mtrgen", async () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mtrgen-syntax-"));

    try {
        fs.mkdirSync(path.join(workspaceRoot, ".mtrgen"), { recursive: true });
        fs.writeFileSync(path.join(workspaceRoot, ".mtrgen", "component.mtr"), "");

        const templatePath = await findAvailableTemplatePath(workspaceRoot, "component.mtr");

        assert.equal(path.basename(templatePath), "component-2.mtr");
        assert.equal(path.dirname(templatePath), path.join(workspaceRoot, ".mtrgen"));
    } finally {
        fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
});

test("resolveGeneratedFilePath rejects files outside the workspace root", () => {
    assert.throws(
        () => resolveGeneratedFilePath("/tmp/workspace", { filePath: "../escape.txt", contents: "" }),
        /outside the workspace root/,
    );
});
