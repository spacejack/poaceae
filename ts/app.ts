import {$e, $i, detectWebGL} from './util'
import {Assets, Loader} from './loader'
import * as input from './input'
import * as anim from './anim'
import * as fullscreen from './fullscreen'
import * as browser from './browser'
import {IWorld, World} from './world'

interface Config {
	blades: number
	depth: number
}

// circa 2016
const CONFIGS: {[id:string]: Config} = {
	mobile:   {blades: 20000,  depth: 50.0},
	laptop:   {blades: 40000,  depth: 65.0},
	desktop:  {blades: 65000,  depth: 85.0},
	desktop2: {blades: 150000, depth: 120.0},
	gamerig:  {blades: 300000, depth: 200.0}
}

/**
 * Create App instance
 */
export default function App() {

	// DOM element containing canvas
	const container = $e('app_canvas_container')

	// Will be set correctly later
	let displayWidth = 640
	let displayHeight = 480

	let renderer: THREE.WebGLRenderer = null
	let assets: Assets
	let world: IWorld

	let isFullscreen = fullscreen.is()

	/**
	 *  Call this when HTML page elements are loaded & ready
	 */
	function run() {
		if (!$e('app_canvas_container')) {
			console.error("app_canvas_container element not found in page")
			return false
		}

		if (!detectWebGL()) {
			$e('loading_text').textContent = "WebGL unavailable."
			return false
		}

		const canvas = $e('app_canvas') as HTMLCanvasElement

		// Make canvas transparent so it isn't rendered as black for 1 frame at startup
		renderer = new THREE.WebGLRenderer({
			canvas: canvas, antialias: true, clearColor: 0xFFFFFF, clearAlpha: 1, alpha: true
		})
		if (!renderer) {
			console.error("Failed to create THREE.WebGLRenderer")
			return false
		}

		resize()
		loadAssets()
		window.addEventListener('resize', resize, false)

		configUI()

		return true
	}

	/**
	 * Configuration UI input handlers
	 */
	function configUI() {
		// Select a config roughly based on device type
		const cfgId = browser.isMobile.any ? 'mobile' : 'desktop'
		const cfg = CONFIGS[cfgId]
		const sel = $i('sel_devicepower')
		sel.value = cfgId
		const inp_blades = $i('inp_blades')
		inp_blades.value = cfg.blades.toString()
		const inp_depth = $i('inp_depth')
		inp_depth.value = cfg.depth.toString()
		$i('chk_fullscreen').checked = false
		$i('chk_fullscreen').onchange = function() {
			fullscreen.toggle($e('app_container'))
		}
		sel.onchange = function(e: Event) {
			const cfg = CONFIGS[sel.value]
			const b = cfg.blades.toString()
			const d = cfg.depth.toString()
			inp_blades.value = b
			inp_depth.value = d
			$e('txt_blades').textContent = b
			$e('txt_depth').textContent = d
		}
		$e('txt_blades').textContent = cfg.blades.toString()
		$e('txt_depth').textContent = cfg.depth.toString()
		inp_blades.onchange = function(e) {
			$e('txt_blades').textContent = inp_blades.value
		}
		inp_depth.onchange = function(e) {
			$e('txt_depth').textContent = inp_depth.value
		}
	}

	function loadAssets() {
		const loader = Loader()
		loader.load(
			{textures: [
				{name: 'grass', url: 'data/grass.jpg'},
				{name: 'skydome', url: 'data/skydome.jpg'},
				{name: 'ground', url: 'data/ground.jpg'}
			]},
			onAssetsLoaded,
			onAssetsProgress,
			onAssetsError
		)
	}

	function onAssetsProgress (p: number) {
		const pct = Math.floor(p * 90)
		$e('loading_bar').style.width = pct+'%'
	}

	function onAssetsError (e: string) {
		$e('loading_text').textContent = e
	}

	function onAssetsLoaded(a: Assets) {
		assets = a
		$e('loading_bar').style.width = '100%'
		$e('loading_text').innerHTML = "&nbsp;"
		setTimeout(function() {
			$e('loading_bar_outer').style.visibility = 'hidden'
			$e('config_block').style.visibility = 'visible'
			$e('btn_start').onclick = function() {
				anim.fadeOut($e('loading_block'), 80, function() {
					$e('loading_block').style.display = 'none'
					$e('btn_fullscreen').onclick = function() {
						console.log('toggling fullscreen')
						fullscreen.toggle($e('app_container'))
					}
					$e('btn_restart').onclick = function() {
						document.location.reload()
					}
					start()
				})
			}
			if (!isFullscreen) {
				$e('title_bar').style.display = 'block'
			}
		}, 10)
	}

	/**
	 *  All stuff loaded, setup event handlers & start the app...
	 */
	function start() {
		input.init()
		// Get detail settings from UI inputs
		const numGrassBlades = +($i('inp_blades').value)
		const grassPatchRadius = +($i('inp_depth').value)
		// Create an instance of the world
		world = World(
			renderer, assets, numGrassBlades, grassPatchRadius,
			displayWidth, displayHeight
		)
		// Start our animation loop
		doFrame()
	}

	function doFrame() {
		// keep animation loop running
		world.doFrame()
		requestAnimationFrame(doFrame)
	}

	/** Handle window resize events */
	function resize() {
		displayWidth = container.clientWidth
		displayHeight = container.clientHeight

		renderer.setSize(displayWidth, displayHeight)

		if (world) {
			world.resize(displayWidth, displayHeight)
		}

		// Seems to be a good place to check for fullscreen toggle.
		const fs = fullscreen.is()
		if (fs !== isFullscreen) {
			// Show/hide the UI when switching windowed/FS mode.
			$e('title_bar').style.display = fs ? 'none' : 'block'
			isFullscreen = fs
		}
	}

	//  Return public interface
	return {
		run: run
	}
}
