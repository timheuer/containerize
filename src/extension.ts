import * as vscode from 'vscode';
import { commands } from 'vscode';
import { Commands } from './enums';
import { containerizeHandler, addPublishContainerTaskHandler } from './commands';
import { Logger } from './logging';

// extension activation
export function activate(context: vscode.ExtensionContext) {
	
	Logger.info(`Activating .NET Containerizer extension...`);
	
	// check for .NET
	const csharpExtension = vscode.extensions.getExtension('ms-dotnettools.csharp');
	if (!csharpExtension) {
		vscode.window.showErrorMessage('The C# Extension is required for this extension to work.');
		return;
	}

	// register the commands
	Logger.info(`Registering .NET Containerizer commands...`);
	registerCommands();	
}

function registerCommands() {
	commands.registerCommand(Commands.containerize, containerizeHandler);
	commands.registerCommand(Commands.addPublishContainerTask, addPublishContainerTaskHandler);
}

// deactivate extension
export function deactivate() {}