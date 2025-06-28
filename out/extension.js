"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
// Stores previous saved text for each document
const lastSavedText = new Map();
const lastHighlights = new Map();
const greenBarDecorationType = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    borderWidth: '0 5px 0 0',
    borderStyle: 'solid',
    borderColor: 'rgba(50, 205, 50, 0.2)',
    backgroundColor: 'rgba(159, 248, 159, 0.05)', // very faint green background
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});
const orangeBarDecorationType = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    borderWidth: '0 5px 0 0',
    borderStyle: 'solid',
    borderColor: 'rgba(255, 165, 0, 0.3)', // faint orange border
    backgroundColor: 'rgba(255, 200, 150, 0.1)', // very faint orange background
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});
let decorationsEnabled = true;
const lastSavedChangedLines = new Map();
const orangeHighlights = new Map();
function activate(context) {
    console.log('Extension "save-line-highlighter" is now active!');
    vscode.workspace.textDocuments.forEach(doc => {
        lastSavedText.set(doc.uri.toString(), doc.getText());
    });
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(document => {
        handleSave(document);
    }), vscode.workspace.onDidChangeTextDocument(event => {
        if (!decorationsEnabled)
            return;
        const docUri = event.document.uri.toString();
        if (!lastHighlights.has(docUri) && !orangeHighlights.has(docUri))
            return;
        const changedLines = new Set();
        event.contentChanges.forEach(change => {
            const startLine = change.range.start.line;
            const endLine = change.range.end.line;
            for (let line = startLine; line <= endLine; line++) {
                changedLines.add(line);
            }
        });
        updateHighlightsOnEdit(event.document, changedLines);
    }), vscode.commands.registerCommand('save-line-highlighter.toggleHighlights', () => {
        decorationsEnabled = !decorationsEnabled;
        if (!decorationsEnabled) {
            // Clear highlights visually but keep data intact
            vscode.window.visibleTextEditors.forEach(editor => {
                editor.setDecorations(greenBarDecorationType, []);
                editor.setDecorations(orangeBarDecorationType, []);
            });
        }
        else {
            // Reapply stored highlights on all visible editors without recalculating
            vscode.window.visibleTextEditors.forEach(editor => {
                const docUri = editor.document.uri.toString();
                const greenDecos = lastHighlights.get(docUri) ?? [];
                const orangeDecos = orangeHighlights.get(docUri) ?? [];
                editor.setDecorations(greenBarDecorationType, greenDecos);
                editor.setDecorations(orangeBarDecorationType, orangeDecos);
            });
        }
        vscode.window.showInformationMessage(`Save Line Highlights are now ${decorationsEnabled ? 'ON' : 'OFF'}`);
    }));
}
function deactivate() { }
function highlightIfEnabled(document) {
    if (!decorationsEnabled)
        return;
    handleSave(document);
}
function handleSave(document) {
    if (!decorationsEnabled)
        return;
    const docUri = document.uri.toString();
    const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === docUri);
    if (!editor)
        return;
    const currentText = document.getText();
    const previousText = lastSavedText.get(docUri) ?? "";
    const currentLines = currentText.split(/\r?\n/);
    const previousLines = previousText.split(/\r?\n/);
    const changedDecorations = [];
    const changedLines = new Set();
    const lineCount = Math.max(currentLines.length, previousLines.length);
    for (let i = 0; i < lineCount; i++) {
        const currentLine = currentLines[i] ?? "";
        const previousLine = previousLines[i] ?? "";
        if (currentLine !== previousLine && i < document.lineCount) {
            const startPos = new vscode.Position(i, 0);
            const endPos = new vscode.Position(i, currentLine.length);
            changedDecorations.push({ range: new vscode.Range(startPos, endPos) });
            changedLines.add(i);
        }
    }
    // Clear all decorations and stored data before applying new
    editor.setDecorations(greenBarDecorationType, []);
    editor.setDecorations(orangeBarDecorationType, []);
    lastHighlights.delete(docUri);
    orangeHighlights.delete(docUri);
    // Apply new green highlights
    editor.setDecorations(greenBarDecorationType, changedDecorations);
    lastHighlights.set(docUri, changedDecorations);
    orangeHighlights.set(docUri, []);
    lastSavedChangedLines.set(docUri, changedLines);
    lastSavedText.set(docUri, currentText);
}
function updateHighlightsOnEdit(document, changedLines) {
    const docUri = document.uri.toString();
    const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === docUri);
    if (!editor)
        return;
    const currentText = document.getText();
    const previousText = lastSavedText.get(docUri) ?? "";
    // If document is empty, clear all highlights and return
    if (currentText.trim().length === 0) {
        lastHighlights.delete(docUri);
        orangeHighlights.delete(docUri);
        editor.setDecorations(greenBarDecorationType, []);
        editor.setDecorations(orangeBarDecorationType, []);
        return;
    }
    const currentLines = currentText.split(/\r?\n/);
    const previousLines = previousText.split(/\r?\n/);
    const oldGreenHighlights = lastHighlights.get(docUri) ?? [];
    const oldOrangeHighlights = orangeHighlights.get(docUri) ?? [];
    const newGreenHighlights = [];
    const newOrangeHighlights = [];
    // Track lines we already processed to avoid duplicates
    const processedLines = new Set();
    // Process green highlights
    for (const deco of oldGreenHighlights) {
        const line = deco.range.start.line;
        const currentLineText = currentLines[line] ?? "";
        const previousLineText = previousLines[line] ?? "";
        if (changedLines.has(line)) {
            // Edited line: promote to orange only if content changed and line exists
            if (line < document.lineCount && currentLineText !== previousLineText && currentLineText.trim().length > 0) {
                const startPos = new vscode.Position(line, 0);
                const endPos = new vscode.Position(line, currentLineText.length);
                newOrangeHighlights.push({ range: new vscode.Range(startPos, endPos) });
                processedLines.add(line);
                // Update lastSavedText for that line
                const updatedLines = previousLines.slice();
                updatedLines[line] = currentLineText;
                lastSavedText.set(docUri, updatedLines.join('\n'));
            }
            else if (currentLineText.trim().length === 0) {
                // Line empty after edit, remove highlight entirely by not adding to any list
                processedLines.add(line);
            }
            else {
                // No actual content change (e.g. cursor move) or line reverted, keep green
                newGreenHighlights.push(deco);
                processedLines.add(line);
            }
        }
        else {
            // Not edited, keep green
            newGreenHighlights.push(deco);
            processedLines.add(line);
        }
    }
    // Process orange highlights
    for (const deco of oldOrangeHighlights) {
        const line = deco.range.start.line;
        const currentLineText = currentLines[line] ?? "";
        if (changedLines.has(line)) {
            if (line < document.lineCount && currentLineText.trim().length > 0) {
                const startPos = new vscode.Position(line, 0);
                const endPos = new vscode.Position(line, currentLineText.length);
                newOrangeHighlights.push({ range: new vscode.Range(startPos, endPos) });
                processedLines.add(line);
                // Update lastSavedText for that line
                const updatedLines = previousLines.slice();
                updatedLines[line] = currentLineText;
                lastSavedText.set(docUri, updatedLines.join('\n'));
            }
            else {
                // Line empty after edit: remove highlight by skipping
                processedLines.add(line);
            }
        }
        else {
            // Not edited, keep orange
            newOrangeHighlights.push(deco);
            processedLines.add(line);
        }
    }
    // In case any new edited lines are not in old highlights (e.g. new edits on lines that were not previously highlighted),
    // they should not be highlighted here, so no need to add them.
    // Finally apply decorations
    editor.setDecorations(greenBarDecorationType, newGreenHighlights);
    editor.setDecorations(orangeBarDecorationType, newOrangeHighlights);
    // Update stored highlights or delete if empty
    if (newGreenHighlights.length === 0)
        lastHighlights.delete(docUri);
    else
        lastHighlights.set(docUri, newGreenHighlights);
    if (newOrangeHighlights.length === 0)
        orangeHighlights.delete(docUri);
    else
        orangeHighlights.set(docUri, newOrangeHighlights);
}
//# sourceMappingURL=extension.js.map