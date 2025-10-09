import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

let emojiList: { char: string; name: string }[] = [];

/**
 * Fonction appelée à l'activation de l'extension
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "markdown-plus" activée.');

    const emojiPath = path.join(context.extensionPath, 'data', 'emojis_list.json');
    if (fs.existsSync(emojiPath)) {
        const raw = fs.readFileSync(emojiPath, 'utf8');
        emojiList = JSON.parse(raw);
        console.log(`✅ ${emojiList.length} emojis chargés.`);
    } else {
        console.warn('⚠️ Fichier emojis.json non trouvé.');
    }

    // Mise à jour automatique dès qu'un document Markdown est modifié
    vscode.workspace.onDidChangeTextDocument((event) => {
        const doc = event.document;
        if (doc.languageId === 'markdown') {
            updateAllChecklists(doc);
            replaceEmojis(event);
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

        // Chercher les tâches qui suivent
        let done = 0;
        let total = 0;
        for (let j = i + 1; j < lines.length; j++) {
            const taskLine = lines[j].trim();
            if (taskLine.match(headerRegex) || taskLine === "") break; // nouvelle checklist ou fin
            if (taskLine.startsWith('- [')) {
                total++;
                if (taskLine.match(/- \[[xX]\]/)) done++;
            }
        }

        if (total === 0) continue;

        // Construire le nouveau header
        const newHeader = `${match[1]}(${done}/${total})${match[2]}`;

        // Si le header a changé, le mettre à jour
        if (line !== newHeader) {
            const headerLine = document.lineAt(i);
            edit.replace(document.uri, headerLine.range, newHeader);
        }

        // Vérifier la présence d’un tag [progress_bar]
        let progressBarLineIndex = -1;
        for (let j = i + 1; j < lines.length; j++) {
            const nextLine = lines[j];
            if (nextLine.match(headerRegex) || nextLine.trim() === "") break;
            if (nextLine.includes("[progress_bar]") || nextLine.includes('▰') || nextLine.includes('▱')) {
                progressBarLineIndex = j;
                break;
            }
        }

        // Si pas de tag [progress_bar], on ne fait rien
        if (progressBarLineIndex === -1) {
            continue;
        }

        // Générer la nouvelle barre de progression
        const progressBar = generateProgressBar(done, total);

        // Remplacer uniquement le contenu du tag
        const progressBarLine = document.lineAt(progressBarLineIndex);

        // Mettre à jour uniquement si différent
        if (progressBar !== progressBarLine.text) {
            edit.replace(document.uri, progressBarLine.range, progressBar);
        }
    }

    // Appliquer toutes les modifications d’un coup
    await vscode.workspace.applyEdit(edit);
}


function generateProgressBar(done: number, total: number, size = 10): string {
    const ratio = done / total;
    const filled = Math.round(size * ratio);
    const empty = size - filled;
    return '▰'.repeat(filled) + '▱'.repeat(empty) + ` ${Math.round(ratio * 100)}%`;
}

/*
    * Remplace les codes emoji (ex: ":grinning_face:") par le caractère emoji correspondant
*/
async function replaceEmojis(event: vscode.TextDocumentChangeEvent) {
    const doc = event.document;
    const editor = vscode.window.activeTextEditor;

    if (!editor || doc.languageId !== 'markdown') return;

    const changes = event.contentChanges;
    if (changes.length === 0) return;

    const lastChange = changes[0];
    const inserted = lastChange.text;

    // On n’agit que si ":" est tapé (potentiel déclencheur de fin de code)
    if (!inserted.includes(':')) return;

    const line = doc.lineAt(lastChange.range.start.line);
    const match = line.text.match(/:([a-z0-9_+\-]+):/i);
    if (!match) return;

    const key = match[1].replace(/_/g, ' '); // ex: "grinning_face" → "grinning face"

    // Recherche de l’emoji par son nom dans la liste
    const emojiEntry = emojiList.find(e => e.name.toLowerCase() === key.toLowerCase());
    if (!emojiEntry) return; // emoji non trouvé

    // Remplace le code texte par le caractère emoji
    const range = new vscode.Range(
        line.range.start.translate(0, match.index ?? 0),
        line.range.start.translate(0, (match.index ?? 0) + match[0].length)
    );

    const edit = new vscode.WorkspaceEdit();
    edit.replace(doc.uri, range, emojiEntry.char);
    await vscode.workspace.applyEdit(edit);
}


/**
 * Fonction appelée à la désactivation
 */
export function deactivate() { }
