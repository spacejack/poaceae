// Creates & animates a large patch of grass to fill the foreground.
// One simple blade of grass mesh is repeated many times using instanced arrays.

import {nrand} from './gmath'
import * as bufferset from './bufferSet'
type BufferSet = bufferset.BufferSet

const BLADE_SEGS = 4 // # of blade segments
const BLADE_VERTS = (BLADE_SEGS + 1) * 2 // # of vertices per blade (1 side)
const BLADE_INDICES = BLADE_SEGS * 12
const BLADE_WIDTH = 0.15
const BLADE_HEIGHT_MIN = 2.0
const BLADE_HEIGHT_MAX = 4.0

const vertScript = `
	precision highp float;

	#define BLADE_SEGS `+BLADE_SEGS.toFixed(1)+` // # of blade segments
	#define BLADE_DIVS (BLADE_SEGS + 1.0)  // # of divisions
	#define BLADE_VERTS (BLADE_DIVS * 2.0) // # of vertices (per side, so 1/2 total)

	uniform mat4 modelViewMatrix;
	uniform mat4 projectionMatrix;
	uniform float patchSize; // size of grass square area (width & height)
	uniform vec2 drawPos; // centre of where we want to draw
	uniform float time;  // used to animate blades

	attribute float vindex; // Which vertex are we drawing - the main thing we need to know
	attribute vec4 offset; // {x:x, y:y, z:z, w:rot} (blade's position & rotation)
	attribute vec4 shape; // {x:width, y:height, z:lean, w:curve} (blade's shape properties)

	varying vec4 vColor;
	varying vec2 vUv;

	vec2 rotate (float x, float y, float r) {
		float c = cos(r);
		float s = sin(r);
		return vec2(x * c - y * s, x * s + y * c);
	}

	void main() {
		float vi = mod(vindex, BLADE_VERTS); // vertex index for this side of the blade
		float di = floor(vi / 2.0);  // div index (0 .. BLADE_DIVS)
		float hpct = di / BLADE_SEGS;  // percent of height of blade this vertex is at
		float bside = floor(vindex / BLADE_VERTS);  // front/back side of blade
		float xside = mod(vi, 2.0);  // left/right edge (x=0 or x=1)
		float x = shape.x * (xside - 0.5) * (1.0 - pow(hpct, 3.0)); // taper blade as approach tip
		// apply blade's natural curve amount, then apply animated curve amount by time
		float curve = shape.w + 0.4 * (sin(time * 4.0 + offset.x * 0.8) + cos(time * 4.0 + offset.y * 0.8));
		float y = shape.z * hpct + curve * (hpct * hpct); // pow(hpct, 2.0);

		// based on centre of view cone position, what grid tile should
		// this piece of grass be drawn at?
		vec2 gridOffset = vec2(
			floor((drawPos.x - offset.x) / patchSize) * patchSize + patchSize / 2.0,
			floor((drawPos.y - offset.y) / patchSize) * patchSize + patchSize / 2.0
		);

		// rotate this blade vertex by this blade's rotation
		vec4 pos = vec4(
			rotate(x, y, offset.w),
			shape.y * di / BLADE_SEGS + offset.z,
			1.0
		);

		// move to grid position and then to blade position
		pos.x += gridOffset.x + offset.x;
		pos.y += gridOffset.y + offset.y;

		// grass texture coordinate for this vertex
		vec2 uv = vec2(xside, di * 2.0);

		// cheap lighting for now - light based on rotation angle of blade
		// and depending on which side of the blade this vertex is on
		// and depending on how high up the blade we are
		// TODO: calculate normal?
		float c = max(cos(offset.w + bside * 3.14159) - (1.0 - hpct) * 0.4, 0.0);
		c = 0.3 + 0.7 * c * c * c;

		// outputs
		vColor = vec4(
			c * 0.85 + cos(offset.x * 80.0) * 0.05,
			c + sin(offset.y * 140.0) * 0.05,
			c + sin(offset.x * 99.0) * 0.05,
			1.0
		);
		vUv = uv;
		gl_Position = projectionMatrix * modelViewMatrix * pos;
	}
`

const fragScript = `
	precision highp float;

	uniform sampler2D map;
	uniform vec3 fogColor;
	uniform float fogNear;
	uniform float fogFar;
	uniform vec3 grassFogColor;
	uniform float grassFogFar;

	varying vec3 vPosition;
	varying vec4 vColor;
	varying vec2 vUv;

	void main() {
		vec4 color = vec4(vColor) * texture2D(map, vec2(vUv.s, vUv.t));
		float depth = gl_FragCoord.z / gl_FragCoord.w;
		// apply 'grass fog' first
		float fogFactor = smoothstep(fogNear, grassFogFar, depth);
		color.rgb = mix(color.rgb, grassFogColor, fogFactor);
		// then apply atmosphere fog
		fogFactor = smoothstep(fogNear, fogFar, depth);
		color.rgb = mix(color.rgb, fogColor, fogFactor);
		// output
		gl_FragColor = color;
	}
`

/**
 * Setup options for grass patch
 */
export interface Options {
	numBlades: number
	radius: number  // distance from centre of patch to edge - half the width of the square
	texture: THREE.Texture
	fogColor: THREE.Color
	fogFar: number
	grassFogColor: THREE.Color
	grassFogFar: number
}

/**
 * Creates a patch of grass mesh.
 */
export function createMesh (opts: Options) {
	// Buffers to use for instances of blade mesh
	const buffers = {
		// Tells the shader which vertex of the blade its working on.
		// Rather than supplying positions, they are computed from this vindex.
		vindex: new Float32Array(BLADE_VERTS * 2 * 1),
		// Shape properties of all blades
		shape: new Float32Array(4 * opts.numBlades),
		// Positon & rotation of all blades
		offset: new Float32Array(4 * opts.numBlades),
		// Indices for a blade
		index: new Uint16Array(BLADE_INDICES)
	}

	initBladeIndices(buffers.index, 0, BLADE_VERTS, 0)
	initBladeShapeVerts(buffers.shape, opts.numBlades)
	initBladeOffsetVerts(buffers.offset, opts.numBlades, opts.radius)
	initBladeIndexVerts(buffers.vindex)

	const geo = new THREE.InstancedBufferGeometry()
	// Make a giant bounding sphere so the mesh never goes out of view.
	// Also, because there are no position vertices, we must create our own bounding sphere.
	geo.boundingSphere = new THREE.Sphere(
		new THREE.Vector3(0,0,0), Math.sqrt(opts.radius * opts.radius * 2.0) * 10000.0
	)
	geo.addAttribute('vindex', new THREE.BufferAttribute(buffers.vindex, 1))
	geo.addAttribute('shape', new THREE.InstancedBufferAttribute(buffers.shape, 4))
	geo.addAttribute('offset', new THREE.InstancedBufferAttribute(buffers.offset, 4))
	geo.setIndex(new THREE.BufferAttribute(buffers.index, 1))

	const tex = opts.texture
	tex.wrapS = tex.wrapT = THREE.RepeatWrapping

	const mat = new THREE.RawShaderMaterial({
		uniforms: {
			time: {type: 'f', value: 0.0},
			map: {type: 't', value: tex},
			patchSize: {type: 'f', value: opts.radius * 2.0},
			drawPos: {type: '2f', value: [0.0, 0.0]},
			fogColor: {type: '3f', value: opts.fogColor.toArray()},
			fogNear: {type: 'f', value: 1.0},
			fogFar: {type: 'f', value: opts.fogFar},
			grassFogColor: {type: '3f', value: opts.grassFogColor.toArray()},
			grassFogFar: {type: 'f', value: opts.grassFogFar}
		},
		vertexShader: vertScript,
		fragmentShader: fragScript
	})
	return new THREE.Mesh(geo, mat)
}

/**
 * Sets up indices for single blade mesh.
 * @param id array of indices
 * @param vc1 vertex start offset for front side of blade
 * @param vc2 vertex start offset for back side of blade
 * @param i index offset
 */
function initBladeIndices(id: Uint16Array, vc1: number, vc2: number, i: number) {
	let seg: number
	// blade front side
	for (seg = 0; seg < BLADE_SEGS; ++seg) {
		id[i++] = vc1 + 0 // tri 1
		id[i++] = vc1 + 1
		id[i++] = vc1 + 2
		id[i++] = vc1 + 2 // tri 2
		id[i++] = vc1 + 1
		id[i++] = vc1 + 3
		vc1 += 2
	}
	// blade back side
	for (seg = 0; seg < BLADE_SEGS; ++seg) {
		id[i++] = vc2 + 2 // tri 1
		id[i++] = vc2 + 1
		id[i++] = vc2 + 0
		id[i++] = vc2 + 3 // tri 2
		id[i++] = vc2 + 1
		id[i++] = vc2 + 2
		vc2 += 2
	}
}

/** Set up shape variations for each blade of grass */
function initBladeShapeVerts(shape: Float32Array, numBlades: number) {
	for (let i = 0; i < numBlades; ++i) {
		shape[i*4+0] = BLADE_WIDTH + Math.random() * BLADE_WIDTH * 0.5 // width
		shape[i*4+1] = BLADE_HEIGHT_MIN + Math.pow(Math.random(), 4.0) * (BLADE_HEIGHT_MAX - BLADE_HEIGHT_MIN) // height
		shape[i*4+2] = 0.0 + Math.random() * 0.7 // lean
		shape[i*4+3] = 0.2 + Math.random() * 0.8 // curve
	}
}

/** Set up positons & rotation for each blade of grass */
function initBladeOffsetVerts(offset: Float32Array, numBlades: number, patchRadius: number) {
	for (let i = 0; i < numBlades; ++i) {
		offset[i*4+0] = nrand() * patchRadius // x
		offset[i*4+1] = nrand() * patchRadius // y
		offset[i*4+2] = 0.0 // z
		offset[i*4+3] = Math.PI * 2.0 * Math.random() // rot
	}
}

/** Set up indices for 1 blade */
function initBladeIndexVerts(vindex: Float32Array) {
	for (let i = 0; i < vindex.length; ++i) {
		vindex[i] = i
	}
}

/**
 * Call each frame to animate grass blades.
 * @param mesh The patch of grass mesh returned from createMesh
 * @param time Time in seconds
 * @param x X coordinate of centre position to draw at
 * @param y Y coord
 */
export function update (mesh: THREE.Mesh, time: number, x: number, y: number) {
	const mat = mesh.material as THREE.RawShaderMaterial
	mat.uniforms.time.value = time
	mat.uniforms.drawPos.value[0] = x
	mat.uniforms.drawPos.value[1] = y
}
