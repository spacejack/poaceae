// Terrain uses a custom shader so that we can apply the same
// type of fog as is applied to the grass. This way they both
// blend to green first, then blend to atmosphere color in the
// distance.

const vertScript = `
	precision highp float;

	uniform mat4 modelViewMatrix;
	uniform mat4 projectionMatrix;
	uniform vec2 uvRepeat;

	attribute vec3 position;
	attribute vec2 uv;

	varying vec2 vUv;

	void main() {
		vUv = uv * uvRepeat.xy;
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`

const fragScript = `
	precision highp float;

	uniform sampler2D map;
	uniform vec3 fogColor;
	uniform float fogNear;
	uniform float fogFar;
	uniform vec3 grassFogColor; // "grass fog"
	uniform float grassFogFar;

	varying vec2 vUv;

	void main() {
		vec4 color = texture2D(map, vUv);
		float depth = gl_FragCoord.z / gl_FragCoord.w;
		// apply 'grass fog' first
		float fogFactor = smoothstep(fogNear, grassFogFar, depth);
		color.rgb = mix(color.rgb, grassFogColor, fogFactor);
		// then apply atmosphere fog
		fogFactor = smoothstep(fogNear, fogFar, depth);
		color.rgb = mix(color.rgb, fogColor, fogFactor);
		gl_FragColor = color;
	}
`

export interface Options {
	texture: THREE.Texture
	fogColor: THREE.Color
	fogFar: number
	grassFogColor: THREE.Color
	grassFogFar: number
}

/** Creates a textured plane larger than the viewer will ever travel */
export function createMesh(opts: Options) {
	const tex = opts.texture
	tex.wrapS = tex.wrapT = THREE.RepeatWrapping
	//tex.repeat.set(1000, 1000)
	const geo = new THREE.PlaneBufferGeometry(10000.0, 10000.0, 1, 1)
	const mat = new THREE.RawShaderMaterial({
		uniforms: {
			map: {type: 't', value: tex},
			uvRepeat: {type: '2f', value: [1200.0, 1200.0]},
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
