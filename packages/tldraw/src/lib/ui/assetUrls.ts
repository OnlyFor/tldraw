import { EMBED_DEFINITIONS, LANGUAGES, RecursivePartial } from '@tldraw/editor'
import { version } from '../ui/version'
import { TLEditorAssetUrls, defaultEditorAssetUrls } from '../utils/static-assets/assetUrls'
import { TLUiIconType, iconTypes } from './icon-types'

/** @public */
export type TLUiAssetUrls = TLEditorAssetUrls & {
	icons: Record<TLUiIconType | Exclude<string, TLUiIconType>, string>
	translations: Record<(typeof LANGUAGES)[number]['locale'], string>
	embedIcons: Record<(typeof EMBED_DEFINITIONS)[number]['type'], string>
}

/** @public */
export type TLUiAssetUrlOverrides = RecursivePartial<TLUiAssetUrls>

export let defaultUiAssetUrls: TLUiAssetUrls = {
	...defaultEditorAssetUrls,
	icons: Object.fromEntries(
		iconTypes.map((name) => [name, `https://cdn.tldraw.xyz/${version}/icons/icon/${name}.svg`])
	) as Record<TLUiIconType, string>,
	translations: Object.fromEntries(
		LANGUAGES.map((lang) => [
			lang.locale,
			`https://cdn.tldraw.xyz/${version}/translations/${lang.locale}.json`,
		])
	) as Record<(typeof LANGUAGES)[number]['locale'], string>,
	embedIcons: Object.fromEntries(
		EMBED_DEFINITIONS.map((def) => [
			def.type,
			`https://cdn.tldraw.xyz/${version}/embed-icons/${def.type}.png`,
		])
	) as Record<(typeof EMBED_DEFINITIONS)[number]['type'], string>,
}

/** @internal */
export function setDefaultUiAssetUrls(urls: TLUiAssetUrls) {
	defaultUiAssetUrls = urls
}

/** @internal */
export function useDefaultUiAssetUrlsWithOverrides(
	overrides?: RecursivePartial<TLUiAssetUrls>
): TLUiAssetUrls {
	if (!overrides) return defaultUiAssetUrls

	return {
		fonts: Object.assign({ ...defaultUiAssetUrls.fonts }, { ...overrides?.fonts }),
		icons: Object.assign({ ...defaultUiAssetUrls.icons }, { ...overrides?.icons }),
		embedIcons: Object.assign({ ...defaultUiAssetUrls.embedIcons }, { ...overrides?.embedIcons }),
		translations: Object.assign(
			{ ...defaultUiAssetUrls.translations },
			{ ...overrides?.translations }
		),
	}
}
