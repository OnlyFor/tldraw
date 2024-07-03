import {
	AssetContextProps,
	MediaHelpers,
	TLAsset,
	TLAssetId,
	WeakCache,
	getAssetFromIndexedDb,
} from 'tldraw'
import { isDevelopmentEnv } from './env'

const objectURLCache = new WeakCache<TLAsset, ReturnType<typeof getLocalAssetObjectURL>>()

export const resolveAsset =
	(persistenceKey?: string) =>
	async (asset: TLAsset | null | undefined, context: AssetContextProps) => {
		if (!asset || !asset.props.src) return null

		// Retrieve a local image from the DB.
		if (persistenceKey && asset.props.src.startsWith('asset:')) {
			return await objectURLCache.get(
				asset,
				async () => await getLocalAssetObjectURL(persistenceKey, asset.id)
			)
		}

		// We don't deal with videos at the moment.
		if (asset.type === 'video') return asset.props.src

		// Assert it's an image to make TS happy.
		if (asset.type !== 'image') return null

		// Don't try to transform data: URLs, yikes.
		if (!asset.props.src.startsWith('http:') && !asset.props.src.startsWith('https:'))
			return asset.props.src

		if (context.shouldResolveToOriginalImage) {
			return asset.props.src
		}

		// Don't try to transform animated images.
		if (MediaHelpers.isAnimatedImageType(asset?.props.mimeType) || asset.props.isAnimated)
			return asset.props.src

		// Don't try to transform vector images.
		if (MediaHelpers.isVectorImageType(asset?.props.mimeType)) return asset.props.src

		// Assets that are under a certain file size aren't worth transforming (and incurring cost).
		if (asset.props.fileSize === -1 || asset.props.fileSize < 1024 * 1024 * 1.5 /* 1.5 MB */)
			return asset.props.src

		// N.B. navigator.connection is only available in certain browsers (mainly Blink-based browsers)
		// 4g is as high the 'effectiveType' goes and we can pick a lower effective image quality for slower connections.
		const networkCompensation =
			!context.networkEffectiveType || context.networkEffectiveType === '4g' ? 1 : 0.5

		const width = Math.ceil(asset.props.w * context.steppedScreenScale * networkCompensation)

		if (isDevelopmentEnv) {
			return asset.props.src
		}

		const url = new URL(asset.props.src)
		url.searchParams.set('tl_opt', '1')
		url.searchParams.set('w', width.toString())
		url.searchParams.set('dpr', context.dpr.toString())
		return url.toString()
	}

async function getLocalAssetObjectURL(persistenceKey: string, assetId: TLAssetId) {
	const blob = await getAssetFromIndexedDb({
		assetId: assetId,
		persistenceKey,
	})
	if (blob) {
		return URL.createObjectURL(blob)
	}
	return null
}
