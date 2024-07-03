import { ExecutionContext, R2Bucket, RequestInitCfPropertiesImage } from '@cloudflare/workers-types'
import { IRequest } from 'itty-router'
import { notFound } from './errors'

declare const fetch: typeof import('@cloudflare/workers-types').fetch

interface UserAssetOpts {
	request: IRequest
	bucket: R2Bucket
	objectName: string
	context: ExecutionContext
}

export async function handleUserAssetUpload({
	request,
	bucket,
	objectName,
}: UserAssetOpts): Promise<Response> {
	if (await bucket.head(objectName)) {
		return Response.json({ error: 'Asset already exists' }, { status: 409 })
	}

	const object = await bucket.put(objectName, request.body, {
		httpMetadata: request.headers,
	})

	return Response.json({ object: objectName }, { headers: { etag: object.httpEtag } })
}

export async function handleUserAssetGet({ request, bucket, objectName, context }: UserAssetOpts) {
	const cacheUrl = new URL(request.url)
	const shouldOptimize =
		request.query.tl_opt !== undefined && /image-resizing/.test(request.headers.get('via') ?? '')

	let format = null
	if (shouldOptimize) {
		const accept = request.headers.get('Accept')
		if (accept && /image\/avif/.test(accept)) {
			format = 'avif' as const
		} else if (accept && /image\/webp/.test(accept)) {
			format = 'webp' as const
		}
	}

	// if we have a format, we want to cache the asset with the format in the URL
	if (format) cacheUrl.searchParams.set('format', format)
	const cacheKey = new Request(cacheUrl.toString(), request)

	// this cache automatically handles range responses etc.
	const cachedResponse = await caches.default.match(cacheKey)
	if (cachedResponse) {
		return cachedResponse
	}

	let headers
	let body
	let status

	// if we're requesting an optimized resource, we-refetch from ourselves with cloudflare's
	// special extra image resizing options:
	if (shouldOptimize) {
		const imageOptions: RequestInitCfPropertiesImage = {}
		if (format) imageOptions.format = format
		if (request.query.w) imageOptions.width = Number(request.query.w)

		const url = new URL(request.url)
		url.searchParams.delete('tl_opt')

		const response = await fetch(url, { headers: request.headers, cf: { image: imageOptions } })

		headers = new Headers(response.headers)
		body = response.body
		status = response.status
	} else {
		// otherwise, we fetch the asset directly from the bucket
		const object = await bucket.get(objectName, {
			range: request.headers,
			onlyIf: request.headers,
		})

		if (!object) {
			return notFound()
		}

		headers = new Headers()
		object.writeHttpMetadata(headers)
		headers.set('etag', object.httpEtag)
		if (object.range) {
			let start
			let end
			if ('suffix' in object.range) {
				start = object.size - object.range.suffix
				end = object.size - 1
			} else {
				start = object.range.offset ?? 0
				end = object.range.length ? start + object.range.length - 1 : object.size - 1
			}
			headers.set('content-range', `bytes ${start}-${end}/${object.size}`)
		}

		body = 'body' in object && object.body ? object.body : null
	}

	// assets are immutable, so we can cache them basically forever:
	headers.set('cache-control', 'public, max-age=31536000, immutable')

	status = body ? (request.headers.get('range') !== null ? 206 : 200) : 304

	if (status === 200) {
		const [cacheBody, responseBody] = body!.tee()
		// cache the response
		context.waitUntil(caches.default.put(cacheKey, new Response(cacheBody, { headers, status })))
		return new Response(responseBody, { headers, status })
	}

	return new Response(body, { headers, status })
}
