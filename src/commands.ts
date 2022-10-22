import * as vscode from 'vscode';
import { window, commands, ExtensionContext } from 'vscode';
import { containerInput } from './containerInput';
import * as glob from 'glob';

export async function containerizeHandler (context: ExtensionContext) {
    // get all the inputs we need
    const inputs = containerInput(context);
    let projectPath = '';

    // now that we have the inputs do stuff
    // find the project
    vscode.workspace.workspaceFolders?.forEach(async (folder) => {
        const projectFiles = glob.sync('**/*.csproj', { cwd: folder.uri.fsPath });
        if (projectFiles.length > 0) {
            const projectFile = projectFiles[0];
            projectPath = folder.uri.fsPath + '/' + projectFile;
        }
    });

    // first ensure the nuget package is there
    const task = new vscode.Task(
        { type: 'dotnet', task: 'add' },
        vscode.TaskScope.Workspace,
        'Add Nuget Package',
        'dotnet',
        new vscode.ShellExecution(`dotnet add ${projectPath} package Microsoft.NET.Build.Containers`)
    );
    vscode.tasks.executeTask(task);

    // then run the publish command
    const pubTask = new vscode.Task(
        { type: 'dotnet', task: 'publish' },
        vscode.TaskScope.Workspace,
        'Publish',
        'dotnet',
        new vscode.ShellExecution(`dotnet publish ${projectPath} --os ${(await inputs).os} --arch ${(await inputs).architecture} /p:ContainerBaseImage=${(await inputs).containerBaseImage} -c Release /p:PublishProfile=DefaultContainer /p:ContainerImageName=${(await inputs).imageName}`)
    );
    vscode.tasks.executeTask(pubTask);
};

export async function addPublishContainerTaskHandler() {
    window.showInformationMessage("Adding publish container task to tasks.json");
};