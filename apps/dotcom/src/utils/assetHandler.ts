import { AssetContextProps, TLAsset, getAssetFromIndexedDb } from 'tldraw'
import { ASSET_UPLOADER_URL } from './config'

export const resolveAsset =
	(persistenceKey?: string) =>
	async (asset: TLAsset | null | undefined, context: AssetContextProps) => {
		if (!asset || !asset.props.src) return null

		// We don't deal with videos at the moment.
		if (asset.type === 'video') return asset.props.src

		// Assert it's an image to make TS happy.
		if (asset.type !== 'image') return null

		// Retrieve a local image from the DB.
		if (persistenceKey && asset.props.src.startsWith('asset:')) {
			const blob = await getAssetFromIndexedDb({
				assetId: asset.id,
				persistenceKey,
			})
			if (blob) {
				return URL.createObjectURL(blob)
			}
			return null
		}

		// Don't try to transform data: URLs, yikes.
		if (!asset.props.src.startsWith('http:') && !asset.props.src.startsWith('https:'))
			return asset.props.src

		if (context.shouldResolveToOriginalImage) {
			return asset.props.src
		}

		// N.B. navigator.connection is only available in certain browsers (mainly Blink-based browsers)
		// 4g is as high the 'effectiveType' goes and we can pick a lower effective image quality for slower connections.
		const networkCompensation =
			!context.networkEffectiveType || context.networkEffectiveType === '4g' ? 1 : 0.5

		const width = Math.ceil(asset.props.w * context.steppedScreenScale * networkCompensation)

		if (process.env.NODE_ENV === 'development') {
			return asset.props.src
		}

		return `${ASSET_UPLOADER_URL}/cdn-cgi/image/width=${width},dpr=${context.dpr},fit=scale-down,quality=92/${asset.props.src}`
	}