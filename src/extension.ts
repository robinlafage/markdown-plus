import * as vscode from 'vscode';

/**
 * Fonction appelée à l'activation de l'extension
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "markdown-checklist-progress" activée.');

    // Commande manuelle (palette)
    const disposable = vscode.commands.registerCommand('markdown-checklist-progress.update', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'markdown') {
            updateAllChecklists(editor.document);
        }
    });

    context.subscriptions.push(disposable);

    // Mise à jour automatique dès qu'un document Markdown est modifié
    vscode.workspace.onDidChangeTextDocument((event) => {
        const doc = event.document;
        if (doc.languageId === 'markdown') {
            updateAllChecklists(doc);
        }
    });
}

/**
 * Met à jour toutes les checklists Markdown (format "(x/y)")
 */
async function updateAllChecklists(document: vscode.TextDocument) {
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    // Regex pour détecter une ligne de checklist
    const headerRegex = /^(.+)\(\s*(?:\d+\/\d+|\/)\s*\)(.*)$/;

    // Liste des edits à appliquer
    const edit = new vscode.WorkspaceEdit();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(headerRegex);
        if (!match) continue; // pas un header de checklist

        // On cherche les tâches qui suivent immédiatement
        let done = 0;
        let total = 0;
        for (let j = i + 1; j < lines.length; j++) {
            const taskLine = lines[j].trim();
            if (taskLine.match(headerRegex) || taskLine == "") break; // nouvelle checklist : stop
            if (taskLine.startsWith('- [')) {
                total++;
                if (taskLine.match(/- \[[xX]\]/)) done++;
            }
        }

        if (total === 0) continue; // pas de tâches → rien à modifier

        const newHeader = `${match[1]}(${done}/${total})${match[2]}`;

        // Ne rien faire si déjà correct
        if (line === newHeader) continue;

        // Ajouter la modification
        const headerLine = document.lineAt(i);
        edit.replace(document.uri, headerLine.range, newHeader);
    }

    // Appliquer toutes les modifications d'un coup
    await vscode.workspace.applyEdit(edit);
}

/**
 * Fonction appelée à la désactivation
 */
export function deactivate() {}
