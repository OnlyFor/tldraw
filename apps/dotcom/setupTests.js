global.crypto ??= new (require('@peculiar/webcrypto').Crypto)()

process.env.MULTIPLAYER_SERVER = 'https://localhost:8787'
process.env.ASSET_UPLOAD = 'https://localhost:8788'
process.env.IMAGE_WORKER = 'https://localhost:8786'

global.TextEncoder = require('util').TextEncoder
global.TextDecoder = require('util').TextDecoder
