import {dot, length2d, setLength2d, normalize2d, pmod, sign} from './gmath'
import * as input from './input'
import notify from './notification'

const DEFAULT_HEIGHT = 4.0
const MIN_HEIGHT = 1.0
const MAX_HEIGHT = 16.0
const DEFAULT_PITCH = -0.15
const MOVE_RANGE = 250.0

const ACCEL = 60.0 // forward accel
const DRAG = 0.1
const VACCEL = 20.0 // vertical accel
const VDRAG = 5.0
const YAW_ACCEL = 4.0 // angular accel (yaw)
const YAW_DRAG = 2.0
const PITCH_ACCEL = 2.0
const PITCH_RESIST = 8.0
const PITCH_FRIC = 4.0
const ROLL_ACCEL = 1.0
const ROLL_RESIST = 5.0
const ROLL_FRIC = 4.0

/** Creates a Player instance (User first person camera) */
export default function Player() {

	let autoplay = true
	let curT = 0

	const state = {
		pos: new THREE.Vector3(0.0, 0.0, DEFAULT_HEIGHT),
		vel: new THREE.Vector3(0.0, 0.0, 0.0),
		yaw: 0.0,
		yawVel: 0.0,
		pitch: 0.0,
		pitchVel: 0.0,
		roll: 0.0,
		rollVel: 0.0
	}

	input.setKeyPressListener(13, function() {
		toggleAutoPlay()
		if (autoplay) {
			notify('Press ENTER to enable manual camera')
		} else {
			notify('ARROWS drive, W/S up/down. Press ENTER to return to auto camera.')
		}
	})

	// scratchpad vectors
	//const _v = new THREE.Vector3()
	const _a = new THREE.Vector3()
	const _d = new THREE.Vector3()

	/**
	 * @param dt Delta time in ms
	 */
	function update(dt: number) {
		curT += dt
		// Update auto or manual
		if (autoplay) {
			updateAuto(curT / 1000.0, dt)
		} else {
			//updateManual(i, dt)
			updateDrone(input.state, dt)
		}
	}

	function toggleAutoPlay() {
		autoplay = !autoplay
		if (autoplay) {
			state.roll = 0
			state.rollVel = 0
			state.pitchVel = 0
			state.yawVel = 0
		}
	}

	function getAutoPlay() {
		return autoplay
	}

	function setAutoPlay(a: boolean) {
		autoplay = !!a
	}

	/**
	 * Update autoplay camera
	 * @param time Time in seconds
	 */
	function updateAuto (time: number, dt: number) {
		// Remember last frame values
		_a.copy(state.pos)
		const yaw0 = state.yaw
		const pitch0 = state.pitch

		// Follow a nice curvy path...
		const r = time * 0.035
		state.pos.x = Math.cos(r) * MOVE_RANGE + Math.sin(r) * MOVE_RANGE * 2.0
		state.pos.y = Math.sin(r) * MOVE_RANGE + Math.cos(r) * MOVE_RANGE * 2.0

		// Move up & down smoothly
		const a = time * 0.3
		state.pos.z = DEFAULT_HEIGHT + 4.5 + Math.cos(a) * 7.0
		// Look up & down depending on height
		state.pitch = DEFAULT_PITCH - 0.25 * Math.sin(a + Math.PI * 0.5)

		// Turn left & right smoothly over time
		state.yaw = Math.sin(time * 0.04) * Math.PI * 2.0 + Math.PI * 0.5

		// Calc velocities based on difs from prev frame
		const ft = dt / 1000.0
		_d.x = state.pos.x - _a.x
		_d.y = state.pos.y - _a.y
		_d.z = state.pos.z - _a.z
		state.vel.x = _d.x / ft
		state.vel.y = _d.y / ft
		state.vel.z = _d.z / ft
		const dyaw = state.yaw - yaw0
		state.yawVel = dyaw / ft
		const dpitch = state.pitch - pitch0
		state.pitchVel = dpitch / ft
	}

	function updateDrone (i: input.State, dt: number) {
		// Delta time in seconds
		const ft = dt / 1000.0

		// calc roll accel
		let ra = 0
		if (i.left > 0) {
			ra = -ROLL_ACCEL
		} else if (i.right > 0) {
			ra = ROLL_ACCEL
		}
		// calc roll resist forces
		let rr = -state.roll * ROLL_RESIST
		let rf = -sign(state.rollVel) * ROLL_FRIC * Math.abs(state.rollVel)
		// total roll accel
		ra = ra + rr + rf
		state.rollVel += ra * ft
		state.roll += state.rollVel * ft

		// Calc yaw accel
		let ya = -state.roll * YAW_ACCEL
		// yaw drag
		let yd = -sign(state.yawVel) * Math.abs(Math.pow(state.yawVel, 3.0)) * YAW_DRAG
		// update yaw
		state.yawVel += (ya + yd) * ft
		state.yaw += state.yawVel * ft

		// Calc pitch accel
		let pa = 0
		if (i.forward > 0) {
			pa = -PITCH_ACCEL
		} else if (i.back > 0) {
			pa = PITCH_ACCEL * 0.5
		}
		// Calc pitch resist forces
		let pr = -state.pitch * PITCH_RESIST
		let pf = -sign(state.pitchVel) * PITCH_FRIC * Math.abs(state.pitchVel)
		// total pitch accel
		pa = pa + pr + pf
		state.pitchVel += pa * ft
		state.pitch += state.pitchVel * ft

		// Calc accel vector
		_a.set(0, 0, 0)
		_a.x = -state.pitch * ACCEL * Math.cos(state.yaw)
		_a.y = -state.pitch * ACCEL * Math.sin(state.yaw)
		// Calc drag vector (horizontal)
		const absVel = length2d(state.vel) // state.vel.length()
		_d.x = -state.vel.x
		_d.y = -state.vel.y
		setLength2d(_d, absVel * DRAG, _d)

		// Calc vertical accel
		if (i.up > 0 && state.pos.z < MAX_HEIGHT - 2.0) {
			_a.z = VACCEL
		} else if (i.down > 0 && state.pos.z > MIN_HEIGHT) {
			_a.z = -VACCEL
		}
		_d.z = -state.vel.z * VDRAG

		// update vel
		state.vel.x += (_a.x + _d.x) * ft
		state.vel.y += (_a.y + _d.y) * ft
		state.vel.z += (_a.z + _d.z) * ft
		// update pos
		state.pos.x += state.vel.x * ft
		state.pos.y += state.vel.y * ft
		state.pos.z += state.vel.z * ft
		if (state.pos.z < MIN_HEIGHT) {
			state.pos.z = MIN_HEIGHT
		} else if (state.pos.z > MAX_HEIGHT) {
			state.pos.z = MAX_HEIGHT
		}
	}

	/**
	 * Public interface
	 */
	return {
		update: update,
		state: state,
		toggleAutoPlay: toggleAutoPlay,
		getAutoPlay: getAutoPlay,
		setAutoPlay: setAutoPlay
	}
}
