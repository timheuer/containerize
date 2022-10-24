/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { QuickPickItem, window, Disposable, CancellationToken, QuickInputButton, QuickInput, ExtensionContext, QuickInputButtons, Uri } from 'vscode';

/**
 * A multi-step input using window.createQuickPick() and window.createInputBox().
 * 
 * This first part uses the helper class `MultiStepInput` that wraps the API for the multi-step case.
 */
export async function containerInput(context: ExtensionContext) {

    const operatingSystems: QuickPickItem[] = ['linux', 'windows'].map(label => ({ label }));
    const arhictectures: QuickPickItem[] = ['x64', 'x86'].map(label => ({ label }));

	const config = vscode.workspace.getConfiguration('dotnetContainerizer');
	const defaultBaseImageName = config.get<string>('baseImageName') || '';
	const defaultTag = config.get<string>('imageTag') || '';

	interface State {
		title: string;
		step: number;
		totalSteps: number;
		containerBaseImage: string;
		tag: string;
        os: QuickPickItem | string;
        architecture: QuickPickItem | string;
		imageName: string;
	}

	async function collectInputs() {
		const state = {} as Partial<State>;
		await MultiStepInput.run(input => pickOS(input, state));
		return state as State;
	}

	const title = 'Provide container metadata';

	async function pickOS(input: MultiStepInput, state: Partial<State>) {
		const pick = await input.showQuickPick({
			title,
			step: 1,
			totalSteps: 5,
			placeholder: 'Choose operating system',
			items: operatingSystems,
			activeItem: typeof state.os !== 'string' ? state.os : undefined,
			shouldResume: shouldResume
		});
		state.os = pick.label;
		return (input: MultiStepInput) => pickArch(input, state);
	}

    async function pickArch(input: MultiStepInput, state: Partial<State>) {
		const pick = await input.showQuickPick({
			title,
			step: 2,
			totalSteps: 5,
			placeholder: 'Choose architecture',
			items: arhictectures,
			activeItem: typeof state.architecture !== 'string' ? state.architecture : undefined,
			shouldResume: shouldResume
		});
		state.architecture = pick.label;
		return (input: MultiStepInput) => inputBaseImageName(input, state);
	}

	async function inputBaseImageName(input: MultiStepInput, state: Partial<State>) {
		state.containerBaseImage = await input.showInputBox({
			title,
			step: 3,
			totalSteps: 5,
			value: state.containerBaseImage || defaultBaseImageName,
			prompt: 'Provide a base container image URI',
			placeholder: 'e.g., mcr.microsoft.com/dotnet/aspnet:7.0', //TODO: get the TFM from project and append
			validate: validateNotNull,
			shouldResume: shouldResume
		});
        return (input: MultiStepInput) => inputTag(input, state);
	}

    async function inputTag(input: MultiStepInput, state: Partial<State>) {
		state.tag = await input.showInputBox({
			title,
			step: 4,
			totalSteps: 5,
			value: state.tag || defaultTag,
			prompt: 'Provide a tag for the container image',
			placeholder: 'latest',
			validate: validateNotNull,
			shouldResume: shouldResume
		});
		return (input: MultiStepInput) => inputImageName(input, state);
	}

	async function inputImageName(input: MultiStepInput, state: Partial<State>) {
		state.imageName = await input.showInputBox({
			title,
			step: 5,
			totalSteps: 5,
			value: state.imageName || '',
			prompt: 'Provide a name for container image',
			validate: validateNotNull,
			shouldResume: shouldResume
		});
	}

	function shouldResume() {
		// Could show a notification with the option to resume.
		return new Promise<boolean>((resolve, reject) => {
			// noop
		});
	}

	async function validateNotNull(name: string) {
		await new Promise(resolve => setTimeout(resolve, 1000));
		return name === '' ? 'Must not be empty' : undefined;
	}

	const state = await collectInputs();
	
	return state;
}


// -------------------------------------------------------
// Helper code that wraps the API for the multi-step case.
// -------------------------------------------------------


class InputFlowAction {
	static back = new InputFlowAction();
	static cancel = new InputFlowAction();
	static resume = new InputFlowAction();
}

type InputStep = (input: MultiStepInput) => Thenable<InputStep | void>;

interface QuickPickParameters<T extends QuickPickItem> {
	title: string;
	step: number;
	totalSteps: number;
	items: T[];
	activeItem?: T;
	placeholder: string;
	buttons?: QuickInputButton[];
	shouldResume: () => Thenable<boolean>;
}

interface InputBoxParameters {
	title: string;
	step: number;
	totalSteps: number;
	value: string;
	prompt: string;
	placeholder?: string;
	validate: (value: string) => Promise<string | undefined>;
	buttons?: QuickInputButton[];
	shouldResume: () => Thenable<boolean>;
}

class MultiStepInput {

	static async run<T>(start: InputStep) {
		const input = new MultiStepInput();
		return input.stepThrough(start);
	}

	private current?: QuickInput;
	private steps: InputStep[] = [];

	private async stepThrough<T>(start: InputStep) {
		let step: InputStep | void = start;
		while (step) {
			this.steps.push(step);
			if (this.current) {
				this.current.enabled = false;
				this.current.busy = true;
			}
			try {
				step = await step(this);
			} catch (err) {
				if (err === InputFlowAction.back) {
					this.steps.pop();
					step = this.steps.pop();
				} else if (err === InputFlowAction.resume) {
					step = this.steps.pop();
				} else if (err === InputFlowAction.cancel) {
					step = undefined;
				} else {
					throw err;
				}
			}
		}
		if (this.current) {
			this.current.dispose();
		}
	}

	async showQuickPick<T extends QuickPickItem, P extends QuickPickParameters<T>>({ title, step, totalSteps, items, activeItem, placeholder, buttons, shouldResume }: P) {
		const disposables: Disposable[] = [];
		try {
			return await new Promise<T | (P extends { buttons: (infer I)[] } ? I : never)>((resolve, reject) => {
				const input = window.createQuickPick<T>();
				input.title = title;
				input.step = step;
				input.totalSteps = totalSteps;
				input.placeholder = placeholder;
				input.items = items;
				if (activeItem) {
					input.activeItems = [activeItem];
				}
				input.buttons = [
					...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
					...(buttons || [])
				];
				disposables.push(
					input.onDidTriggerButton(item => {
						if (item === QuickInputButtons.Back) {
							reject(InputFlowAction.back);
						} else {
							resolve(<any>item);
						}
					}),
					input.onDidChangeSelection(items => resolve(items[0])),
					input.onDidHide(() => {
						(async () => {
							reject(shouldResume && await shouldResume() ? InputFlowAction.resume : InputFlowAction.cancel);
						})()
							.catch(reject);
					})
				);
				if (this.current) {
					this.current.dispose();
				}
				this.current = input;
				this.current.show();
			});
		} finally {
			disposables.forEach(d => d.dispose());
		}
	}

	async showInputBox<P extends InputBoxParameters>({ title, step, totalSteps, value, prompt, validate, buttons, shouldResume, placeholder }: P) {
		const disposables: Disposable[] = [];
		try {
			return await new Promise<string | (P extends { buttons: (infer I)[] } ? I : never)>((resolve, reject) => {
				const input = window.createInputBox();
				input.title = title;
				input.step = step;
				input.totalSteps = totalSteps;
				input.value = value || '';
				input.prompt = prompt;
				input.buttons = [
					...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
					...(buttons || [])
				];
				input.placeholder = placeholder;
				let validating = validate('');
				disposables.push(
					input.onDidTriggerButton(item => {
						if (item === QuickInputButtons.Back) {
							reject(InputFlowAction.back);
						} else {
							resolve(<any>item);
						}
					}),
					input.onDidAccept(async () => {
						const value = input.value;
						input.enabled = false;
						input.busy = true;
						if (!(await validate(value))) {
							resolve(value);
						}
						input.enabled = true;
						input.busy = false;
					}),
					input.onDidChangeValue(async text => {
						const current = validate(text);
						validating = current;
						const validationMessage = await current;
						if (current === validating) {
							input.validationMessage = validationMessage;
						}
					}),
					input.onDidHide(() => {
						(async () => {
							reject(shouldResume && await shouldResume() ? InputFlowAction.resume : InputFlowAction.cancel);
						})()
							.catch(reject);
					})
				);
				if (this.current) {
					this.current.dispose();
				}
				this.current = input;
				this.current.show();
			});
		} finally {
			disposables.forEach(d => d.dispose());
		}
	}
}