import * as vscode from 'vscode';

// Stores previous saved text for each document
const lastSavedText = new Map<string, string>();
const lastHighlights = new Map<string, vscode.DecorationOptions[]>();

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

const lastSavedChangedLines = new Map<string, Set<number>>();
const orangeHighlights = new Map<string, vscode.DecorationOptions[]>();

export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "save-line-highlighter" is now active!');

  vscode.workspace.textDocuments.forEach(doc => {
    lastSavedText.set(doc.uri.toString(), doc.getText());
  });

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(document => {
      handleSave(document);
    }),

    vscode.workspace.onDidChangeTextDocument(event => {
      if (!decorationsEnabled) return;

      const docUri = event.document.uri.toString();
      if (!lastHighlights.has(docUri) && !orangeHighlights.has(docUri)) return;

      const changedLines = new Set<number>();
      event.contentChanges.forEach(change => {
        const startLine = change.range.start.line;
        const endLine = change.range.end.line;
        for (let line = startLine; line <= endLine; line++) {
          changedLines.add(line);
        }
      });

      updateHighlightsOnEdit(event.document, changedLines);
    }),

vscode.commands.registerCommand('save-line-highlighter.toggleHighlights', () => {
  decorationsEnabled = !decorationsEnabled;

  if (!decorationsEnabled) {
    // Clear highlights visually but keep data intact
    vscode.window.visibleTextEditors.forEach(editor => {
      editor.setDecorations(greenBarDecorationType, []);
      editor.setDecorations(orangeBarDecorationType, []);
    });
  } else {
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
	})
  );

}

export function deactivate() {}

function highlightIfEnabled(document: vscode.TextDocument) {
  if (!decorationsEnabled) return;
  handleSave(document);
}

function handleSave(document: vscode.TextDocument) {
  if (!decorationsEnabled) return;

  const docUri = document.uri.toString();
  const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === docUri);
  if (!editor) return;

  const currentText = document.getText();
  const previousText = lastSavedText.get(docUri) ?? "";

  const currentLines = currentText.split(/\r?\n/);
  const previousLines = previousText.split(/\r?\n/);

  const changedDecorations: vscode.DecorationOptions[] = [];
  const changedLines = new Set<number>();
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

function updateHighlightsOnEdit(document: vscode.TextDocument, changedLines: Set<number>) {
  const docUri = document.uri.toString();
  const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === docUri);
  if (!editor) return;

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

  const newGreenHighlights: vscode.DecorationOptions[] = [];
  const newOrangeHighlights: vscode.DecorationOptions[] = [];

  // Track lines we already processed to avoid duplicates
  const processedLines = new Set<number>();

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
      } else if (currentLineText.trim().length === 0) {
        // Line empty after edit, remove highlight entirely by not adding to any list
        processedLines.add(line);
      } else {
        // No actual content change (e.g. cursor move) or line reverted, keep green
        newGreenHighlights.push(deco);
        processedLines.add(line);
      }
    } else {
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
      } else {
        // Line empty after edit: remove highlight by skipping
        processedLines.add(line);
      }
    } else {
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
  if (newGreenHighlights.length === 0) lastHighlights.delete(docUri);
  else lastHighlights.set(docUri, newGreenHighlights);

  if (newOrangeHighlights.length === 0) orangeHighlights.delete(docUri);
  else orangeHighlights.set(docUri, newOrangeHighlights);
}



