import { join } from 'path'
import { REPO_ROOT, writeJsonFile } from './file'

interface Label {
	// this is what the label is 'called' on github
	name: string
	// this is how we describe the label in our pull request template
	description: string
	// this is the section title for the label in our changelogs
	changelogTitle: string
}

const TYPE_LABELS = [
	{
		name: `improvement`,
		description: `Product Improvement`,
		changelogTitle: '💄 Product Improvements',
	},
	{ name: `bugfix`, description: `Bug fix`, changelogTitle: '🐛 Bug Fixes' },
	{
		name: `api`,
		description: `API Change`,
		changelogTitle: '🛠️ API Changes',
	},
	{ name: `other`, description: `Internal or flagship .com change`, changelogTitle: '🤷 Other' },
] as const satisfies Label[]

export function getLabelNames() {
	return [...TYPE_LABELS].map((label) => label.name)
}

function formatTemplateOption(label: Label) {
	return `- [ ] \`${label.name}\` — ${label.description}`
}

export function formatLabelOptionsForPRTemplate() {
	let result = `\n<!-- ❗ Please select a 'Type' label ❗️ -->\n\n`
	for (const label of TYPE_LABELS) {
		result += formatTemplateOption(label) + '\n'
	}
	return result
}

export async function generateAutoRcFile() {
	const autoRcPath = join(REPO_ROOT, '.autorc')
	await writeJsonFile(autoRcPath, {
		plugins: ['npm', '../scripts/lib/auto-plugin.js'],
		labels: [...TYPE_LABELS].map(({ name, changelogTitle }) => ({
			name,
			changelogTitle,
			releaseType: 'none',
		})),
	})
}
