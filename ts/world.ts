import {difAngle} from './gmath'
import {Assets} from './loader'
import Player from './player'
import * as grass from './grass'
import * as terrain from './terrain'
import * as skydome from './skydome'

const VIEW_DEPTH = 1000.0

const MAX_TIMESTEP = 67 // max 67 ms/frame

const FOG_COLOR = new THREE.Color(0.92, 0.94, 0.98)
const GRASS_FOG_COLOR = new THREE.Color(0.46, 0.56, 0.38)

const MAX_GLARE = 0.25 // max glare effect amount
const GLARE_RANGE = 1.1 // angular range of effect
const GLARE_YAW = Math.PI * 1.5 // yaw angle when looking directly at sun
const GLARE_PITCH = 0.2 // pitch angle looking at sun

const INTRO_FADE_DUR = 2000

export interface IWorld {
	doFrame() : void
	resize(w: number, h: number) : void
}

interface MeshSet {
	ground: THREE.Mesh
	grass: THREE.Mesh
	sky: THREE.Mesh
	sunFlare: THREE.Mesh
	fade: THREE.Mesh // used for intro fade from white
}

///////////////////////////////////////////////////////////////////////
/**
 * Create a World instance
 */
export function World(
	renderer: THREE.WebGLRenderer, assets: Assets,
	numGrassBlades: number, grassPatchRadius: number,
	displayWidth: number, displayHeight: number
) : IWorld {

	// Setup some render values based on provided configs
	const fogDist = grassPatchRadius * 10.0
	const grassFogDist = grassPatchRadius * 2.0
	const camera = new THREE.PerspectiveCamera(
		45, displayWidth / displayHeight, 1, VIEW_DEPTH
	)
	const meshes: MeshSet = {
		ground: null, grass: null, sky: null, sunFlare: null, fade: null
	}

	const scene = new THREE.Scene()

	// Setup the camera so Z is up.
	// Then we have cartesian X,Y coordinates along ground plane.
	camera.rotation.order = "ZXY"
	camera.rotation.x = Math.PI * 0.5
	camera.rotation.y = Math.PI * 0.5
	camera.rotation.z = Math.PI
	camera.up.set(0.0, 0.0, 1.0)

	// Put camera in an object so we can transform it normally
	const camHolder = new THREE.Object3D()
	camHolder.rotation.order = "ZYX"
	camHolder.add(camera)

	scene.add(camHolder)

	// Prevent three from sorting objs, we'll add them to the scene
	// in the order we want them drawn, because we know grass is in front
	// of everything, ground in front of sky, and transparent fullscreen
	// overlays get drawn last.
	renderer.sortObjects = false

	// Create a large patch of grass to fill the foreground
	meshes.grass = grass.createMesh({
		numBlades: numGrassBlades,
		radius: grassPatchRadius,
		texture: assets.textures['grass'],
		fogColor: FOG_COLOR,
		fogFar: fogDist,
		grassFogColor: GRASS_FOG_COLOR,
		grassFogFar: grassFogDist
	})
	scene.add(meshes.grass)

	// Create repeating-textured ground plane with
	// custom fog to blend with grass in distance
	meshes.ground = terrain.createMesh({
		texture: assets.textures['ground'],
		fogColor: FOG_COLOR,
		fogFar: fogDist,
		grassFogColor: GRASS_FOG_COLOR,
		grassFogFar: grassFogDist
	})
	scene.add(meshes.ground)

	// Skydome
	meshes.sky = skydome.createMesh(assets.textures['skydome'], VIEW_DEPTH * 0.95, VIEW_DEPTH * 0.95)
	scene.add(meshes.sky)
	meshes.sky.position.z = -25.0

	// White plane to cover screen for fullscreen fade-in from white
	meshes.fade = new THREE.Mesh(
		new THREE.PlaneBufferGeometry(6.0, 4.0, 1, 1),
		new THREE.MeshBasicMaterial({
			color: 0xFFFFFF, fog: false, transparent: true, opacity: 1.0,
			depthTest: false, depthWrite: false
		})
	)
	meshes.fade.position.x = 2.0  // place directly in front of camera
	meshes.fade.rotation.y = Math.PI * 1.5
	camHolder.add(meshes.fade)

	// Bright yellow plane for sun glare using additive blending
	// to blow out the colours
	meshes.sunFlare = new THREE.Mesh(
		new THREE.PlaneBufferGeometry(6.0, 4.0, 1, 1),
		new THREE.MeshBasicMaterial({
			color: 0xFFF844, fog: false, transparent: true, opacity: 0.0,
			depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending
		})
	)
	meshes.sunFlare.position.x = 2.05
	meshes.sunFlare.rotation.y = Math.PI * 1.5
	meshes.sunFlare.visible = false
	camHolder.add(meshes.sunFlare)

	// Create a Player instance
	const player = Player()

	// For timing
	let prevT = Date.now() // prev frame time (ms)
	let simT = 0 // total running time (ms)

	///////////////////////////////////////////////////////////////////
	// Public World instance methods

	/**
	 * Call every frame
	 */
	function doFrame() {
		const curT = Date.now()
		let dt = curT - prevT

		if (dt > 0) {
			// only do computations if time elapsed
			if (dt > MAX_TIMESTEP) {
				// don't exceed max timestep
				dt = MAX_TIMESTEP
				prevT = curT - MAX_TIMESTEP
			}
			// update sim
			update(dt)
			// render it
			render()
			// remember prev frame time
			prevT = curT
		}
	}

	/** Handle window resize events */
	function resize(w: number, h: number) {
		displayWidth = w
		displayHeight = h
		camera.aspect = displayWidth / displayHeight
		camera.updateProjectionMatrix()
	}

	///////////////////////////////////////////////////////////////////
	// Private instance methods

	/**
	 * Logic update
	 */
	function update (dt: number) {
		// Intro fade from white
		if (simT < INTRO_FADE_DUR) {
			updateFade(dt)
		}

		simT += dt
		const t = simT * 0.001

		// Move player (viewer)
		player.update(dt)
		const ppos = player.state.pos
		const pyaw = player.state.yaw
		const ppitch = player.state.pitch
		const proll = player.state.roll

		// Move skydome with player
		meshes.sky.position.x = ppos.x
		meshes.sky.position.y = ppos.y

		// Update grass.
		// Here we specify the centre position of the square patch to
		// be drawn. That would be directly in front of the camera, the
		// distance from centre to edge of the patch.
		grass.update(
			meshes.grass, t,
			ppos.x + Math.cos(pyaw) * grassPatchRadius,
			ppos.y + Math.sin(pyaw) * grassPatchRadius
		)

		// Update camera location/orientation
		camHolder.position.copy(ppos)
		camHolder.rotation.z = pyaw
		// Player considers 'up' pitch positive, but cam pitch (about Y) is reversed
		camHolder.rotation.y = -ppitch
		camHolder.rotation.x = proll

		// Update sun glare effect
		updateGlare()
	}

	/** Update how much glare effect by how much we're looking at the sun */
	function updateGlare() {
		const dy = Math.abs(difAngle(GLARE_YAW, player.state.yaw))
		const dp = Math.abs(difAngle(GLARE_PITCH, player.state.pitch)) * 1.375
		const sunVisAngle = Math.sqrt(dy * dy + dp * dp)
		if (sunVisAngle < GLARE_RANGE) {
			const glare = MAX_GLARE * Math.pow((GLARE_RANGE - sunVisAngle) / (1.0 + MAX_GLARE), 0.75)
			meshes.sunFlare.material.opacity = Math.max(0.0, glare)
			meshes.sunFlare.visible = true
		} else {
			meshes.sunFlare.visible = false
		}
	}

	/** Update intro fullscreen fade from white */
	function updateFade(dt: number) {
		if (simT + dt >= INTRO_FADE_DUR) {
			// fade is complete - hide cover
			meshes.fade.material.opacity = 0.0
			meshes.fade.visible = false
		} else {
			// update fade opacity
			meshes.fade.material.opacity = 1.0 - Math.pow(simT / INTRO_FADE_DUR, 2.0)
		}
	}

	function render () {
		renderer.render(scene, camera)
	}

	///////////////////////////////////////////////////////////////////
	// Return public interface
	return {
		doFrame: doFrame,
		resize: resize
	}
}
