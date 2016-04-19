export const PI2: number = Math.PI * 2.0

export function sign (n:number) {
	return (n > 0 ? 1 : n < 0 ? -1 : 0)
}

export function roundFrac(n: number, places: number) {
	const d = Math.pow(10, places)
	return Math.round((n + 0.000000001) * d) / d
}

export function clamp (n:number, min:number, max:number) {
	return Math.min(Math.max(n, min), max)
}

/**  Always positive modulus */
export function pmod (n:number, m:number) {
	return ((n % m + m) % m)
}

/** A random number from -1.0 to 1.0 */
export function nrand() {
	return Math.random() * 2.0 - 1.0
}

export function angle (x:number, y:number) {
	return pmod(Math.atan2(y, x), PI2)
}

export function difAngle (a0:number, a1:number) {
	const r = pmod(a1, PI2) - pmod(a0, PI2)
	return Math.abs(r) < Math.PI ? r : r - PI2 * sign(r)
}

export function dot (x0:number, y0:number, x1:number, y1:number) : number {
	return (x0 * x1 + y0 * y1)
}

// Some handy vector funcs that will work on any struct with x,y properties
export interface Vec2 {
	x: number
	y: number
}

export function dot2d (a: Vec2, b: Vec2) {
	return (a.x * b.x + a.y * b.y)
}

export function length2d(v: Vec2) {
	return Math.sqrt(v.x * v.x + v.y * v.y)
}

export function setLength2d (v: Vec2, l: number, out: Vec2) {
	let s = length2d(v)
	if (s > 0.0) {
		s = l / s
		out.x = v.x * s
		out.y = v.y * s
	}
	else {
		out.x = l
		out.y = 0.0
	}
}

export function normalize2d(v: Vec2, out: Vec2) {
	setLength2d (v, 1.0, out)
}
