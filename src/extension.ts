import * as vscode from 'vscode';
import { commands } from 'vscode';
import { Commands } from './enums';
import { containerizeHandler, addPublishContainerTaskHandler } from './commands';

// extension activation
export function activate(context: vscode.ExtensionContext) {
	
	// check for .NET
	const csharpExtension = vscode.extensions.getExtension('ms-dotnettools.csharp');
	if (!csharpExtension) {
		vscode.window.showErrorMessage('The C# Extension is required for this extension to work.');
		return;
	}

	// register the commands
	registerCommands();	
}

function registerCommands() {
	commands.registerCommand(Commands.containerize, containerizeHandler);
	commands.registerCommand(Commands.addPublishContainerTask, addPublishContainerTaskHandler);
}

// deactivate extension
export function deactivate() {}