// loader that provides a dictionary of named assets

export class Assets {
	textures : {[id: string]: THREE.Texture} = {}
}

export interface AssetDescription {
	name: string
	url: string
}

export interface AssetList {
	textures: AssetDescription[]
}

/** Loader 'constructor' */
export function Loader() {

	let isLoading = false
	let totalToLoad = 0
	let numLoaded = 0
	let numFailed = 0
	let success_cb : (a: Assets) => any
	let progress_cb : (p: number) => any
	let error_cb : (e: string) => any
	let done_cb : (ok: boolean) => any
	let assets = new Assets()

	function load(
		assetList: AssetList,
		success?: (a: Assets) => any,
		progress?: (p: number) => any,
		error?: (e: string) => any,
		done?: (ok: boolean) => any
	) {
		success_cb = success
		progress_cb = progress
		error_cb = error
		done_cb = done
		assets = new Assets()
		totalToLoad = assetList.textures.length
		numLoaded = 0
		numFailed = 0
		isLoading = true

		for (let i = 0; i < assetList.textures.length; ++i)
			loadTexture(assetList.textures[i])
	}

	function loadTexture (ad: AssetDescription) {
		assets.textures[ad.name] = new THREE.TextureLoader().load(ad.url, doProgress)
	}

	function doProgress () : void {
		numLoaded += 1
		if (progress_cb)
			progress_cb(numLoaded / totalToLoad)
		tryDone()
	}

	function doError (e: string) : void {
		if( error_cb )
			error_cb(e)
		numFailed += 1
		tryDone()
	}

	function tryDone() : boolean {
		if (!isLoading)
			return true
		if (numLoaded + numFailed >= totalToLoad) {
			const ok = !numFailed
			if (ok && success_cb)
				success_cb(assets)
			if (done_cb)
				done_cb(ok)
			isLoading = false
		}
		return !isLoading
	}

	/**
	 *  Public interface
	 */
	return {
		load: load,
		getAssets: () => assets
	}

} // end Loader
